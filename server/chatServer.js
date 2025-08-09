import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

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
const users = new Map(); // socketId -> userInfo
const rooms = new Map(); // roomId -> roomInfo
const userRooms = new Map(); // userId -> roomId

// 默认创建一个公共聊天室
rooms.set('public', {
  id: 'public',
  name: '公共聊天室',
  users: new Set(),
  messages: []
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log(`用户连接: ${socket.id}`);

  // 用户加入聊天室
  socket.on('join-room', (data) => {
    const { username, roomId = 'public' } = data;
    
    // 存储用户信息
    const userInfo = {
      id: socket.id,
      username,
      joinTime: new Date()
    };
    users.set(socket.id, userInfo);
    userRooms.set(socket.id, roomId);

    // 加入房间
    socket.join(roomId);
    
    // 更新房间用户列表
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        name: roomId === 'public' ? '公共聊天室' : roomId,
        users: new Set(),
        messages: []
      });
    }
    
    const room = rooms.get(roomId);
    room.users.add(socket.id);

    // 通知房间内其他用户有新用户加入
    socket.to(roomId).emit('user-joined', {
      username,
      message: `${username} 加入了聊天室`,
      timestamp: new Date()
    });

    // 发送当前房间信息给新用户
    socket.emit('room-info', {
      roomId,
      roomName: room.name,
      userCount: room.users.size,
      recentMessages: room.messages.slice(-50) // 发送最近50条消息
    });

    // 发送在线用户列表
    const onlineUsers = Array.from(room.users).map(id => {
      const user = users.get(id);
      return user ? { id: user.id, username: user.username } : null;
    }).filter(Boolean);
    
    io.to(roomId).emit('users-list', onlineUsers);

    console.log(`${username} 加入房间 ${roomId}`);
  });

  // 处理聊天消息
  socket.on('send-message', (data) => {
    const user = users.get(socket.id);
    const roomId = userRooms.get(socket.id);
    
    if (!user || !roomId) {
      socket.emit('error', { message: '用户未加入任何房间' });
      return;
    }

    const message = {
      id: Date.now() + Math.random(),
      username: user.username,
      content: data.message,
      timestamp: new Date(),
      type: 'message'
    };

    // 存储消息到房间历史
    const room = rooms.get(roomId);
    if (room) {
      room.messages.push(message);
      // 限制历史消息数量
      if (room.messages.length > 1000) {
        room.messages = room.messages.slice(-1000);
      }
    }

    // 广播消息到房间内所有用户
    io.to(roomId).emit('new-message', message);
    
    console.log(`${user.username} 在房间 ${roomId} 发送消息: ${data.message}`);
  });

  // 处理私聊消息
  socket.on('private-message', (data) => {
    const sender = users.get(socket.id);
    const { targetUserId, message } = data;
    
    if (!sender) {
      socket.emit('error', { message: '发送者信息不存在' });
      return;
    }

    const privateMessage = {
      id: Date.now() + Math.random(),
      from: sender.username,
      fromId: socket.id,
      content: message,
      timestamp: new Date(),
      type: 'private'
    };

    // 发送给目标用户
    socket.to(targetUserId).emit('private-message', privateMessage);
    // 发送给发送者确认
    socket.emit('private-message-sent', privateMessage);
    
    console.log(`${sender.username} 向 ${targetUserId} 发送私聊消息`);
  });

  // 用户正在输入
  socket.on('typing', (data) => {
    const user = users.get(socket.id);
    const roomId = userRooms.get(socket.id);
    
    if (user && roomId) {
      socket.to(roomId).emit('user-typing', {
        username: user.username,
        isTyping: data.isTyping
      });
    }
  });

  // 创建新房间
  socket.on('create-room', (data) => {
    const { roomName } = data;
    const roomId = `room_${Date.now()}`;
    
    rooms.set(roomId, {
      id: roomId,
      name: roomName,
      users: new Set(),
      messages: [],
      creator: socket.id
    });

    socket.emit('room-created', { roomId, roomName });
    
    // 广播新房间信息给所有用户
    io.emit('room-list-updated', getRoomsList());
    
    console.log(`新房间创建: ${roomName} (${roomId})`);
  });

  // 获取房间列表
  socket.on('get-rooms', () => {
    socket.emit('rooms-list', getRoomsList());
  });

  // 用户断开连接
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    const roomId = userRooms.get(socket.id);
    
    if (user && roomId) {
      // 从房间中移除用户
      const room = rooms.get(roomId);
      if (room) {
        room.users.delete(socket.id);
        
        // 通知房间内其他用户
        socket.to(roomId).emit('user-left', {
          username: user.username,
          message: `${user.username} 离开了聊天室`,
          timestamp: new Date()
        });

        // 更新在线用户列表
        const onlineUsers = Array.from(room.users).map(id => {
          const u = users.get(id);
          return u ? { id: u.id, username: u.username } : null;
        }).filter(Boolean);
        
        io.to(roomId).emit('users-list', onlineUsers);
      }
      
      console.log(`${user.username} 断开连接`);
    }

    // 清理用户数据
    users.delete(socket.id);
    userRooms.delete(socket.id);
  });
});

// 获取房间列表的辅助函数
function getRoomsList() {
  return Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    userCount: room.users.size
  }));
}

// REST API 端点
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    onlineUsers: users.size,
    activeRooms: rooms.size
  });
});

app.get('/api/rooms', (req, res) => {
  res.json(getRoomsList());
});

app.get('/api/room/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: '房间不存在' });
  }
  
  res.json({
    roomId,
    roomName: room.name,
    messages: room.messages.slice(-100) // 返回最近100条消息
  });
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
