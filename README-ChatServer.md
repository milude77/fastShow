# 实时聊天室后端服务器

这是一个基于 Node.js、Express 和 Socket.IO 的实时聊天室后端服务器，支持多房间聊天、私聊、用户管理等功能。

## 功能特性

### 🚀 核心功能
- **实时消息传输** - 基于 WebSocket 的实时通信
- **多房间支持** - 用户可以创建和加入不同的聊天室
- **用户管理** - 在线用户列表、用户加入/离开通知
- **消息历史** - 自动保存和加载聊天历史记录
- **私聊功能** - 支持用户之间的私人消息
- **输入状态** - 显示用户正在输入的状态
- **房间管理** - 动态创建房间、获取房间列表

### 🛠 技术特性
- **跨域支持** - 配置了 CORS 允许跨域访问
- **RESTful API** - 提供 HTTP API 接口
- **优雅关闭** - 支持服务器优雅关闭
- **错误处理** - 完善的错误处理机制
- **内存存储** - 使用 Map 数据结构高效存储数据

## 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务器
```bash
# 仅启动聊天服务器
npm run server

# 或者同时启动前端和聊天服务器
npm run dev:chat
```

服务器将在 `http://localhost:3001` 启动。

### 3. 测试连接
访问健康检查端点：
```
http://localhost:3001/api/health
```

## API 接口

### HTTP REST API

#### 健康检查
```
GET /api/health
```
返回服务器状态信息，包括在线用户数和活跃房间数。

#### 获取房间列表
```
GET /api/rooms
```
返回所有可用房间的列表。

#### 获取房间消息历史
```
GET /api/room/:roomId/messages
```
获取指定房间的消息历史记录（最近100条）。

### WebSocket 事件

#### 客户端发送事件

| 事件名 | 参数 | 描述 |
|--------|------|------|
| `join-room` | `{username, roomId}` | 加入指定房间 |
| `send-message` | `{message}` | 发送消息到当前房间 |
| `private-message` | `{targetUserId, message}` | 发送私聊消息 |
| `typing` | `{isTyping}` | 发送输入状态 |
| `create-room` | `{roomName}` | 创建新房间 |
| `get-rooms` | - | 获取房间列表 |

#### 服务器发送事件

| 事件名 | 数据 | 描述 |
|--------|------|------|
| `room-info` | `{roomId, roomName, userCount, recentMessages}` | 房间信息 |
| `new-message` | `{id, username, content, timestamp, type}` | 新消息 |
| `user-joined` | `{username, message, timestamp}` | 用户加入通知 |
| `user-left` | `{username, message, timestamp}` | 用户离开通知 |
| `users-list` | `[{id, username}]` | 在线用户列表 |
| `user-typing` | `{username, isTyping}` | 用户输入状态 |
| `private-message` | `{id, from, fromId, content, timestamp, type}` | 私聊消息 |
| `room-created` | `{roomId, roomName}` | 房间创建成功 |
| `rooms-list` | `[{id, name, userCount}]` | 房间列表 |
| `error` | `{message}` | 错误信息 |

## 使用示例

### 1. 基本连接和加入房间
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

// 连接成功后加入房间
socket.on('connect', () => {
    socket.emit('join-room', {
        username: '用户名',
        roomId: 'public' // 可选，默认为 public
    });
});

// 接收房间信息
socket.on('room-info', (data) => {
    console.log('房间信息:', data);
});
```

### 2. 发送和接收消息
```javascript
// 发送消息
socket.emit('send-message', {
    message: '你好，世界！'
});

// 接收新消息
socket.on('new-message', (message) => {
    console.log('新消息:', message);
});
```

### 3. 私聊功能
```javascript
// 发送私聊消息
socket.emit('private-message', {
    targetUserId: '目标用户的socket ID',
    message: '这是一条私聊消息'
});

// 接收私聊消息
socket.on('private-message', (message) => {
    console.log('收到私聊:', message);
});
```

## 客户端示例

项目包含一个完整的 HTML 客户端示例：`client-example/chat-client.html`

要使用示例客户端：
1. 启动聊天服务器：`npm run server`
2. 在浏览器中打开 `client-example/chat-client.html`
3. 输入用户名和房间ID（可选）
4. 开始聊天！

## 数据结构

### 用户信息
```javascript
{
    id: 'socket_id',
    username: '用户名',
    joinTime: Date
}
```

### 房间信息
```javascript
{
    id: '房间ID',
    name: '房间名称',
    users: Set, // 用户ID集合
    messages: [], // 消息历史
    creator: 'socket_id' // 创建者ID（可选）
}
```

### 消息格式
```javascript
{
    id: 'unique_id',
    username: '发送者用户名',
    content: '消息内容',
    timestamp: Date,
    type: 'message' | 'private'
}
```

## 配置选项

### 端口配置
默认端口为 3001，可以通过环境变量修改：
```bash
PORT=8080 npm run server
```

### CORS 配置
当前配置允许所有来源访问，生产环境建议修改：
```javascript
const io = new Server(server, {
  cors: {
    origin: "https://yourdomain.com",
    methods: ["GET", "POST"]
  }
});
```

## 性能和限制

- **消息历史限制**：每个房间最多保存 1000 条历史消息
- **用户名长度**：建议限制在 20 个字符以内
- **消息长度**：建议限制在 500 个字符以内
- **房间数量**：理论上无限制，但建议监控内存使用

## 扩展建议

### 数据持久化
当前使用内存存储，生产环境建议：
- 使用 Redis 存储会话和临时数据
- 使用 MongoDB/PostgreSQL 存储消息历史
- 实现数据备份和恢复机制

### 安全增强
- 添加用户认证和授权
- 实现消息内容过滤
- 添加频率限制防止垃圾消息
- 使用 HTTPS 和 WSS 加密传输

### 功能扩展
- 文件和图片分享
- 消息回复和引用
- 用户角色和权限管理
- 消息加密
- 推送通知

## 故障排除

### 常见问题

1. **连接失败**
   - 检查服务器是否正常启动
   - 确认端口 3001 未被占用
   - 检查防火墙设置

2. **消息发送失败**
   - 确认用户已成功加入房间
   - 检查网络连接状态
   - 查看服务器控制台错误信息

3. **用户列表不更新**
   - 检查 WebSocket 连接状态
   - 确认事件监听器正确设置

### 调试模式
启动服务器时会在控制台输出详细日志，包括：
- 用户连接/断开信息
- 消息发送记录
- 房间操作日志
- 错误信息

## 许可证

MIT License - 详见 LICENSE 文件
