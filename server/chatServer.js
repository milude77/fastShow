import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import knex from 'knex';
import knexConfig from './knexfile.cjs'; // 注意这里是 .cjs 扩展名
import bcrypt from 'bcrypt'; // 导入 bcrypt

// 初始化 Knex 数据库连接
const db = knex(knexConfig.development);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 中间件
app.use(cors());
app.use(express.json());

// 存储在线用户和聊天室信息
// onlineUsers: socketId -> { userId, username }
const onlineUsers = new Map();

// Socket.IO 连接处理
io.on('connection', (socket) => {
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
      const nextId = (maxIdResult.maxId || 0) + 1;
      // 格式化为 6 位字符串，例如 1 -> "000001"
      const formattedId = String(nextId).padStart(6, '0');

      // 插入用户，并指定ID
      await db('users').insert({ id: formattedId, username, password_hash: hashedPassword });
      const user = { id: formattedId, username }; // 使用格式化后的ID

      // 注册成功后自动登录
      onlineUsers.set(socket.id, { userId: user.id, username: user.username });
      socket.emit('user-registered', { userId: user.id, username: user.username });
      console.log(`${user.username} (ID: ${user.id}) 已注册并登录`);

      // 检查并发送离线消息 (同登录逻辑)
      const undeliveredMessages = await db('messages')
        .where({ receiver_id: user.id, status: 'sent' })
        .orderBy('timestamp', 'asc');

      for (const msg of undeliveredMessages) {
        const senderUser = await db('users').where({ id: msg.sender_id }).first();
        if (senderUser) {
          socket.emit('new-message', {
            id: msg.id,
            username: senderUser.username,
            content: msg.content,
            timestamp: msg.timestamp,
            type: 'private',
            senderId: msg.sender_id,
            receiverId: msg.receiver_id
          });
          await db('messages').where({ id: msg.id }).update({ status: 'delivered' });
        }
      }

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
      onlineUsers.set(socket.id, { userId: user.id, username: user.username });
      socket.emit('login-success', { userId: user.id, username: user.username });
      console.log(`${user.username} (ID: ${user.id}) 已登录`);

      // 检查并发送离线消

    } catch (error) {
      console.error('登录失败:', error);
      socket.emit('error', { message: '登录失败，请稍后再试' });
    }
  });

  socket.on('send-disconnect-message', async(user) => {
    const undeliveredMessages = await db('messages')
      .where({ receiver_id: user.userId, status: 'sent' })
      .orderBy('timestamp', 'asc');

    for (const msg of undeliveredMessages) {
      const senderUser = await db('users').where({ id: msg.sender_id }).first();
      if (senderUser) {
        socket.emit('new-message', {
          id: msg.id,
          username: senderUser.username,
          content: msg.content,
          timestamp: msg.timestamp,
          type: 'private',
          senderId: msg.sender_id,
          receiverId: msg.receiver_id
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
      room_id: `private_${Math.min(senderInfo.userId, receiverUser.id)}_${Math.max(senderInfo.userId, receiverUser.id)}`, // 确定性私聊房间ID
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
        socket.emit('friends-list', []);
        return;
      }

      const friends = await db('users').whereIn('id', friendIds).select('id', 'username');
      const onlineUserIds = new Set(Array.from(onlineUsers.values()).map(u => u.userId));

      const friendsWithStatus = friends.map(friend => ({
        ...friend,
        isOnline: onlineUserIds.has(friend.id)
      }));

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
        .where('username', 'like', `%${searchTerm}%`)
        .select('id', 'username');
      socket.emit('search-results', users);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  });

  // 添加好友
  socket.on('add-friend', async (friendId) => {
    const senderInfo = onlineUsers.get(socket.id);

    // 安全检查：确保用户已登录
    if (!senderInfo) {
      socket.emit('error', { message: '用户未登录，无法添加好友' });
      return;
    }

    if (!friendId) {
      socket.emit('error', { message: '需要提供好友ID' });
      return;
    }

    // 用户不能添加自己为好友
    if (senderInfo.userId === friendId) {
      socket.emit('error', { message: '不能添加自己为好友' });
      return;
    }

    try {
      // 检查是否已经是好友或已发送请求
      const existingFriendship = await db('friendships')
        .where({ user_id: senderInfo.userId, friend_id: friendId })
        .orWhere({ user_id: friendId, friend_id: senderInfo.userId })
        .first();

      if (existingFriendship) {
        socket.emit('error', { message: '已经是好友或已发送请求' });
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

      socket.emit('friend-request-sent');
    } catch (error) {
      console.error('Error adding friend:', error);
      socket.emit('error', { message: '添加好友失败' });
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

// REST API 端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    onlineUsersCount: onlineUsers.size,
  });
});

app.get('/api/users', async (req, res) => {
  try {
    const usersList = await db('users').select('id', 'username');
    const onlineUserIds = new Set(Array.from(onlineUsers.values()).map(u => u.userId));

    const usersWithStatus = usersList.map(user => ({
      ...user,
      isOnline: onlineUserIds.has(user.id)
    }));
    res.json(usersWithStatus);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: '无法获取用户列表' });
  }
});

app.get('/api/messages/:user1Id/:user2Id', async (req, res) => {
  const { user1Id, user2Id } = req.params;
  const roomId = `private_${Math.min(user1Id, user2Id)}_${Math.max(user1Id, user2Id)}`;

  try {
    const messages = await db('messages')
      .where({ room_id: roomId })
      .orderBy('timestamp', 'asc')
      .limit(100); // 返回最近100条消息

    const messagesWithUsernames = await Promise.all(messages.map(async msg => {
      const sender = await db('users').where({ id: msg.sender_id }).first();
      const receiver = await db('users').where({ id: msg.receiver_id }).first();
      return {
        id: msg.id,
        senderId: msg.sender_id,
        senderUsername: sender ? sender.username : 'Unknown',
        receiverId: msg.receiver_id,
        receiverUsername: receiver ? receiver.username : 'Unknown',
        content: msg.content,
        timestamp: msg.timestamp,
        type: msg.type,
        status: msg.status,
        roomId: msg.room_id
      };
    }));

    res.json(messagesWithUsernames);
  } catch (error) {
    console.error(`Error fetching messages for private chat between ${user1Id} and ${user2Id}:`, error);
    res.status(500).json({ error: '无法获取私聊消息' });
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
