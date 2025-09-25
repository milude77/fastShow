import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import knex from 'knex';
import knexConfig from './knexfile.cjs'; // 注意这里是 .cjs 扩展名
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';


// 获取当前文件的目录路径（ES模块中需要这样处理）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化 Knex 数据库连接
const db = knex(knexConfig.development);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
});

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase the limit to 50mb or adjust as needed

// 存储在线用户和聊天室信息
// onlineUsers: socketId -> { userId, username }
const onlineUsers = new Map();

// Socket.IO 连接处理
console.log('Socket.IO server initialized, waiting for connections...'); // 新增日志
io.on('connection', (socket) => {
  // 文件上传处理
  app.post('/api/upload', async (req, res) => {
    const { fileName, fileContent, receiverId, senderId } = req.body;
    if (!fileName || !fileContent || !receiverId || !senderId) {
      return res.status(400).json({ error: '所有字段都是必需的' });
    }


    try {
      // 生成唯一的文件ID和文件名
      const fileId = crypto.randomBytes(8).toString('hex');
      const fileExtension = path.extname(fileName);
      const safeFileName = `${fileId}_${Date.now()}${fileExtension}`;

      // 确保上传目录存在
      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // 保存文件
      const filePath = path.join(uploadDir, safeFileName);
      const fileBuffer = Buffer.from(fileContent, 'base64');
      fs.writeFileSync(filePath, fileBuffer);

      // 获取文件大小
      const fileSize = fileBuffer.length;

      // 检查接收者是否存在
      const receiverUser = await db('users').where({ id: receiverId }).first();
      if (!receiverUser) {
        return res.status(404).json({ error: `用户ID ${receiverId} 不存在` });
      }

      // 创建文件消息记录
      const newMessage = {
        sender_id: senderId,
        receiver_id: receiverId,
        content: `[文件] ${fileName}`,
        room_id: `private_${Math.min(receiverId, senderId)}_${Math.max(receiverId, senderId)}`,
        message_type: 'file',
        file_name: fileName,
        file_path: safeFileName,
        file_url: `/api/download/${fileId}`,
        file_size: fileSize,
        file_id: fileId,
        timestamp: new Date(),
        status: 'sent'
      };

      // 存储消息到数据库
      const [messageId] = await db('messages').insert(newMessage);

      // 构建要发送的消息对象
      const savedMessage = {
        id: messageId,
        content: newMessage.content,
        timestamp: newMessage.timestamp,
        senderId: newMessage.sender_id,
        receiverId: newMessage.receiver_id,
        senderUsername: senderId,
        receiverUsername: receiverUser.username,
        type: 'private',
        messageType: 'file',
        fileName: fileName,
        fileUrl: newMessage.file_url,
        fileSize: fileSize,
        fileId: fileId
      };

      // 返回成功响应
      res.status(200).json({ message: '文件上传成功', messageData: savedMessage });

      // 查找接收方是否在线
      const targetSocketId = Array.from(onlineUsers.entries())
        .find(([, uInfo]) => uInfo.userId === receiverId)?.[0];

      if (targetSocketId) {
        // 接收方在线，直接发送
        io.to(targetSocketId).emit('new-message', savedMessage);
        await db('messages').where({ id: messageId }).update({ status: 'delivered' });
      } else {
        // 接收方离线，消息状态保持 'sent' (待投递)
        console.log(`用户 ${receiverUser.username} 离线，文件消息将等待上线后投递`);
      }
    } catch (error) {
      console.error('文件上传失败:', error);
      res.status(500).json({ error: '文件上传失败，请稍后再试' });
    }
  });
  console.log(`用户连接: ${socket.id}`);

  // 用户注册
  socket.on('register-user', async (data) => {
    const { username, password } = data;

    if (!username || !password) {
      socket.emit('error', { message: '用户名和密码是必需的' });
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10); // 哈希密码

      // 获取当前最大ID，并生成新ID
      const maxIdResult = await db('users').max('id as maxId').first();
      const nextId = (+maxIdResult.maxId || 0) + 1;
      const formattedId = String(nextId).padStart(6, '0');

      // 插入用户，并指定ID
      await db('users').insert({ id: formattedId, username, password_hash: hashedPassword });

      socket.emit('user-registered', { userId: formattedId, username });


    } catch (error) {
      console.error('注册用户失败:', error);
      socket.emit('error', { message: '注册失败，请稍后再试' });
    }
  });

  // 用户登录
  socket.on('login-user', async (data) => {
    const { userId, password } = data; // 接收 userId 作为登录凭证

    if (!userId || !password) {
      socket.emit('error', { message: '用户ID和密码是必需的' });
      return;
    }

    try {
      const user = await db('users').where({ id: userId }).first(); // 根据ID查找用户
      if (!user) {
        socket.emit('error', { message: '用户ID或密码不正确' });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        socket.emit('error', { message: '用户ID或密码不正确' });
        return;
      }

      // 登录成功
      const formattedId = String(user.id).padStart(6, '0');
      const token = jwt.sign({ userId: formattedId, username: user.username }, 'your_secret_key', { expiresIn: '2d' });
      onlineUsers.set(socket.id, { userId: formattedId, username: user.username });
      socket.emit('login-success', { userId: formattedId, username: user.username, token });


    } catch (error) {
      console.error('登录失败:', error);
      socket.emit('error', { message: '登录失败，请稍后再试' });
    }
  });

  socket.on('login-with-token', async (data) => {
    const token = data;

    if (!token) {
      socket.emit('error', { message: '需要提供Token' });
      return;
    }

    try {
      const decoded = jwt.verify(token, 'your_secret_key');
      const user = await db('users').where({ id: decoded.userId }).first();

      if (!user) {
        socket.emit('error', { message: '无效的Token' });
        return;
      }

      const formattedId = String(user.id).padStart(6, '0');

      const newToken = jwt.sign({ userId: formattedId, username: user.username }, 'your_secret_key', { expiresIn: '2d' });
      onlineUsers.set(socket.id, { userId: formattedId, username: user.username });
      socket.emit('login-success', { userId: formattedId, username: user.username, newToken });
    } catch (error) {
      console.error('登录失败:', error);
      if (error.name === 'TokenExpiredError') {
        socket.emit('error', { message: 'Token已过期，请重新登录' });
      } else {
        socket.emit('error', { message: '登录失败，请稍后再试' });
      }
    }
  });

  socket.on('send-disconnect-message', async (user) => {
    const undeliveredMessages = await db('messages')
      .where({ receiver_id: user.userId, status: 'sent' })
      .orderBy('timestamp', 'asc');

    for (const msg of undeliveredMessages) {
      const senderUser = await db('users').where({ id: msg.sender_id }).first();
      if (senderUser) {
        socket.emit('new-message', {
          id: `temp_${Date.now()}`,
          username: senderUser.username,
          content: msg.content,
          timestamp: msg.timestamp,
          type: 'private',
          senderId: msg.sender_id,
          receiverId: msg.receiver_id,
          messageType: msg.message_type,
          fileName: msg.file_name,
          fileUrl: msg.file_url,
          fileSize: msg.file_size,
        });
        await db('messages').where({ id: msg.id }).update({ status: 'delivered' });
      }
    }
  });

  // 处理私聊消息
  socket.on('send-private-message', async (data) => {
    const senderInfo = onlineUsers.get(socket.id);
    const { message, receiverId } = data; // 接收 receiverId

    if (!senderInfo) {
      socket.emit('error', { message: '发送者信息不存在' });
      return;
    }
    if (!receiverId) {
      socket.emit('error', { message: '接收者ID是必需的' });
      return;
    }

    const receiverUser = await db('users').where({ id: receiverId }).first(); // 根据ID查找接收者
    if (!receiverUser) {
      socket.emit('error', { message: `用户ID ${receiverId} 不存在` });
      return;
    }

    const newMessage = {
      sender_id: senderInfo.userId,
      receiver_id: receiverUser.id,
      room_id: `private_${Math.min(senderInfo.userId, receiverUser.id)}_${Math.max(senderInfo.userId, receiverUser.id)}`,
      content: message,
      timestamp: new Date(),
      status: 'sent'
    };

    // 存储消息到数据库
    const [messageId] = await db('messages').insert(newMessage);
    const savedMessage = {
      id: messageId,
      content: newMessage.content,
      timestamp: newMessage.timestamp,
      senderId: newMessage.sender_id, // 使用驼峰命名
      receiverId: newMessage.receiver_id, // 使用驼峰命名
      senderUsername: senderInfo.username,
      receiverUsername: receiverUser.username,
      type: 'private'
    };

    // 查找接收方是否在线
    const targetSocketId = Array.from(onlineUsers.entries())
      .find(([, uInfo]) => uInfo.userId === receiverUser.id)?.[0];

    if (targetSocketId) {
      // 接收方在线，直接发送
      io.to(targetSocketId).emit('new-message', savedMessage);
      await db('messages').where({ id: messageId }).update({ status: 'delivered' });
      console.log(`消息从 ${senderInfo.username} 发送给在线用户 ${receiverUser.username}`);
    } else {
      // 接收方离线，消息状态保持 'sent' (待投递)
      console.log(`用户 ${receiverUser.username} 离线，消息将等待上线后投递`);
    }
  });

  // 用户正在输入
  socket.on('typing', (data) => {
    const senderInfo = onlineUsers.get(socket.id);
    const { receiverId } = data; // 针对私聊的 typing，接收 receiverId

    if (senderInfo && receiverId) {
      const targetSocketId = Array.from(onlineUsers.entries())
        .find(([, uInfo]) => uInfo.userId === receiverId)?.[0]; // 根据ID查找

      if (targetSocketId) {
        io.to(targetSocketId).emit('user-typing', {
          username: senderInfo.username,
          isTyping: data.isTyping
        });
      }
    }
  });

  // 获取好友列表
  socket.on('get-friends', async () => {
    const senderInfo = onlineUsers.get(socket.id);
    if (!senderInfo) return;

    try {
      const friendships = await db('friendships')
        .where({ user_id: senderInfo.userId, status: 'accepted' })
        .orWhere({ friend_id: senderInfo.userId, status: 'accepted' });

      const friendIds = friendships.map(f => f.user_id === senderInfo.userId ? f.friend_id : f.user_id);

      if (friendIds.length === 0) {
        socket.emit('friends-list', {});
        return;
      }

      const friends = await db('users').whereIn('id', friendIds).select('id', 'username');
      const onlineUserIds = new Set(Array.from(onlineUsers.values()).map(u => u.userId));

      const friendsWithStatus = friends.reduce((acc, friend) => {
        acc[friend.id] = {
          id: friend.id,
          username: friend.username,
          isOnline: onlineUserIds.has(friend.id)
        };
        return acc;
      }, {});

      socket.emit('friends-list', friendsWithStatus);
    } catch (error) {
      console.error('Error fetching friends:', error);
      socket.emit('error', { message: '获取好友列表失败' });
    }
  });

  // 搜索用户
  socket.on('search-users', async (searchTerm) => {
    console.log(`搜索用户: ${searchTerm}`);
    if (!searchTerm) return;

    try {
      const users = await db('users')
        .where('id', 'like', `%${searchTerm}%`)
        .orWhere('username', 'like', `%${searchTerm}%`)
        .select('id', 'username')
        .limit(15);
      socket.emit('search-results', users);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  });

  // 添加好友
  socket.on('add-friend', async (friendId) => {
    const senderInfo = onlineUsers.get(socket.id);


    if (!friendId) {
      socket.emit('add-friends-msg',{ success: false, message: '好友id不可为空' });
      return 
    }

    // 用户不能添加自己为好友
    if (senderInfo.userId == friendId) {
      socket.emit('add-friends-msg',{ success: false, message: '不能添加自己为好友' });
      return;
    }

    try {
      // 检查是否已经是好友或已发送请求
      const existingFriendship = await db('friendships')
        .where({ user_id: senderInfo.userId, friend_id: friendId })
        .orWhere({ user_id: friendId, friend_id: senderInfo.userId })
        .first();

      if (existingFriendship) {
        socket.emit('add-friends-msg', { success: false, message: '已经是好友或已发送请求' });
        return;
      }

      await db('friendships').insert({
        user_id: senderInfo.userId,
        friend_id: friendId,
        status: 'pending'
      });

      // 查找对方是否在线，以便发送实时通知
      const targetSocketId = Array.from(onlineUsers.entries())
        .find(([, uInfo]) => uInfo.userId === friendId)?.[0];

      if (targetSocketId) {
        // 发送完整的用户信息（ID和用户名）
        io.to(targetSocketId).emit('new-friend-request', {
          from: {
            id: senderInfo.userId,
            username: senderInfo.username
          }
        });
      }

      socket.emit('add-friends-msg', { success: true });
    } catch (error) {
      console.error('Error adding friend:', error);
      socket.emit('add-friends-msg', { success: false, message: '添加好友失败' });
    }
  });

  // 获取好友请求
  socket.on('get-friend-requests', async () => {
    const senderInfo = onlineUsers.get(socket.id);
    if (!senderInfo) return;

    try {
      const requests = await db('friendships')
        .where({ friend_id: senderInfo.userId, status: 'pending' })
        .join('users', 'friendships.user_id', 'users.id')
        .select('users.id', 'users.username');
      socket.emit('friend-requests', requests);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  });

  // 接受好友请求
  socket.on('accept-friend-request', async (requesterId) => {
    const senderInfo = onlineUsers.get(socket.id);
    if (!senderInfo || !requesterId) return;

    try {
      await db('friendships')
        .where({ user_id: requesterId, friend_id: senderInfo.userId, status: 'pending' })
        .update({ status: 'accepted' });

      // 通知对方请求已被接受
      const targetSocketId = Array.from(onlineUsers.entries())
        .find(([, uInfo]) => uInfo.userId === requesterId)?.[0];
      if (targetSocketId) {
        io.to(targetSocketId).emit('friend-request-accepted', { by: senderInfo.username });
      }

      // 重新获取好友列表
      socket.emit('friend-request-accepted', { requesterId });
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  });

  // Heartbeat
  socket.on('heartbeat', (payload) => {
    if (payload === 'ping') {
      socket.emit('heartbeat', 'pong');
    }
  });

  // 用户断开连接
  socket.on('disconnect', () => {
    const userInfo = onlineUsers.get(socket.id);

    if (userInfo) {
      console.log(`${userInfo.username} (ID: ${userInfo.userId}) 断开连接`);
    }

    // 清理用户数据
    onlineUsers.delete(socket.id);
  });
});

// 静态文件服务（用于文件下载）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// REST API 端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    onlineUsersCount: onlineUsers.size,
  });
});

// 文件下载接口
app.get('/api/download/:fileId', async (req, res) => {
  const { fileId } = req.params;

  try {
    // 从数据库查找文件信息
    const fileMessage = await db('messages')
      .where({ file_id: fileId, message_type: 'file' })
      .first();

    if (!fileMessage) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 构建文件路径
    const filePath = path.join(__dirname, 'uploads', fileMessage.file_path);

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileMessage.file_name)}"`);
    res.setHeader('Content-Type', fileMessage.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', fileMessage.file_size);

    // 发送文件
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('文件下载失败:', error);
    res.status(500).json({ error: '文件下载失败' });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`聊天室服务器运行在端口 ${PORT}`);
  console.log(`WebSocket 服务已启动`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

export default app;

