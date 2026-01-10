import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
// import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import knex from 'knex';
import knexConfig from './knexfile.cjs'; // 注意这里是 .cjs 扩展名
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as Minio from 'minio';

// 获取当前文件的目录路径（ES模块中需要这样处理）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 根据环境变量选择配置，默认为 'development'
const environment = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[environment]);

// --- MinIO 配置 ---
// 请将以下占位符替换为您的真实 MinIO 配置
const minioClient = new Minio.Client({
  endPoint: process.env.MINIENDPOINT || '127.0.0.1',
  port: process.env.MINIPORT || '9000',
  useSSL: false,
  accessKey: process.env.MINIKEY || 'minioadmin',
  secretKey: process.env.MINISKEY || 'minioadmin',
});
const bucketName = 'fastshow'; // 您的存储桶名称

// 确保存储桶存在
minioClient.bucketExists(bucketName, (err, exists) => {
  if (err) {
    return console.log(err);
  }
  if (!exists) {
    minioClient.makeBucket(bucketName, 'us-east-1', (err) => {
      if (err) return console.log('创建存储桶错误:', err);
      console.log(`存储桶 '${bucketName}' 已成功创建.`);
    });
  } else {
    console.log(`存储桶 '${bucketName}' 已存在.`);
  }
});
// --- MinIO 配置结束 ---

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
const onlineUsersIds = new Map();

// Fetches and emits the friends list for a given socket
async function getFriendsList(socket) {
  const senderInfo = onlineUsers.get(socket.id);
  if (!senderInfo) {
    socket.emit('error', { message: '未登录或会话无效' });
    return;
  }

  try {
    const friendships = await db('friendships')
      .where({ user_id: senderInfo.userId, status: 'accepted' })
      .orWhere({ friend_id: senderInfo.userId, status: 'accepted' });

    const friendIds = friendships.map(f => f.user_id === senderInfo.userId ? f.friend_id : f.user_id);

    const friends = await db('users').whereIn('id', friendIds).select('id', 'username');
    const onlineUserIds = new Set(Array.from(onlineUsers.values()).map(u => u.userId));

    const friendsWithStatus = friends.map(friend => ({
      id: friend.id,
      username: friend.username,
      isOnline: onlineUserIds.has(friend.id),
      type: 'friend'
    }));

    return friendsWithStatus;
  } catch (error) {
    console.error('Error fetching friends:', error);
    socket.emit('error', { message: '获取好友列表失败' });
  }
}

// Fetches and emits the groups list for a given socket
async function getGroupsList(socket) {
  const senderInfo = onlineUsers.get(socket.id);
  if (!senderInfo) {
    socket.emit('error', { message: '未登录或会话无效' });
    return;
  }
  const baseGroups = await db('group_members as gm')
    .join('groups as g', 'gm.group_id', 'g.id')
    .where('gm.user_id', senderInfo.userId)
    .select(
      'g.id as groupId',
      'g.name as groupName',
      'gm.user_name as myName',
      'gm.role as myRole',
      'gm.created_at as joinedAt',
      'g.created_at',
      'g.updated_at'
    )
    .orderBy('g.updated_at', 'desc');



  // 组装返回结构：每个群附带成员列表
  const payload = baseGroups.map(g => ({
    id: g.groupId,
    username: g.groupName,
    myName: g.myName,
    myRole: g.myRole,
    joinedAt: g.joinedAt,
    type: 'group'
  }));
  return payload;

}
async function handleSendDisconnectMessage(socket, user) {
  // 使用 JOIN 查询一次性获取未送达的私聊消息和发送者信息
  const undeliveredMessages = await db('messages as m')
    .join('users as u', 'm.sender_id', 'u.id')
    .where({ 'm.receiver_id': user.userId, 'm.status': 'sent' })
    .select(
      'm.message_id',
      'm.sender_id',
      'm.receiver_id',
      'm.content',
      'm.timestamp',
      'm.message_type',
      'm.file_name',
      'm.file_url',
      'm.file_size',
      'u.username as sender_username'
    )
    .orderBy('m.timestamp', 'asc');


  // 使用 JOIN 查询一次性获取未送达的群聊消息和发送者信息
  const undeliveredGroupMessages = await db('group_message_read_status as gmrs')
    .join('group_messages as gm', 'gm.message_id', 'gmrs.group_message_id')
    .join('users as u', 'gm.sender_id', 'u.id')
    .where({ 'gmrs.user_id': user.userId, 'gmrs.status': 'sent' })
    .select(
      'gm.message_id',
      'gm.sender_id',
      'gm.group_id as receiver_id',
      'gm.content',
      'gm.timestamp',
      'gm.message_type',
      'gm.file_name',
      'gm.file_url',
      'gm.file_size',
      'u.username as sender_username'
    )
    .orderBy('gm.timestamp', 'asc');

  // 发送群聊消息
  for (const msg of undeliveredGroupMessages) {
    socket.emit('new-message', {
      message_id: msg.message_id,
      username: msg.sender_username,
      content: msg.content,
      timestamp: msg.timestamp,
      type: 'group',
      senderId: msg.sender_id,
      receiverId: msg.receiver_id,
      messageType: msg.message_type,
      fileName: msg.file_name,
      fileUrl: msg.file_url,
      fileSize: msg.file_size,
      status: 'success'
    });
    await db('group_message_read_status').where({ group_message_id: msg.message_id }).where({ user_id: user.userId }).update({ status: 'delivered' });
  }

  // 发送私聊消息
  for (const msg of undeliveredMessages) {
    socket.emit('new-message', {
      message_id: msg.message_id,
      username: msg.sender_username,
      content: msg.content,
      timestamp: msg.timestamp,
      type: 'private',
      senderId: msg.sender_id,
      receiverId: msg.receiver_id,
      messageType: msg.message_type,
      fileName: msg.file_name,
      fileUrl: msg.file_url,
      fileSize: msg.file_size,
      status: 'success'
    });
    await db('messages').where({ message_id: msg.message_id }).update({ status: 'delivered' });
  }
}

async function handleGetFriendRequests(socket) {
  const senderInfo = onlineUsers.get(socket.id);
  if (!senderInfo) return;

  try {
    const requests = await db('friendships')
      .where({ friend_id: senderInfo.userId, status: 'pending' })
      .join('users', 'friendships.user_id', 'users.id')
      .select('friendships.id as id', 'users.id as inviterId', 'users.username as inviterName');
    requests.forEach(request => {
      socket.emit('new-friend-request', request);
    });

    const groupInvite = await db('group_invitations as gi')
      .where({ invited_user_id: senderInfo.userId, status: 'pending' })
      .join('groups as g', 'gi.group_id', 'g.id')
      .join('users as u', 'gi.inviting_user_id', 'u.id')
      .select('gi.id as id', 'g.id as groupId', 'u.username as inviterName', 'gi.invited_user_id as inviterId', 'g.name as groupName');
    groupInvite.forEach(invite => {
      socket.emit('group-invite', invite);
    });

  } catch (error) {
    console.error('Error fetching friend requests:', error);
  }
}

// Socket.IO 连接处理
console.log('Socket.IO server initialized, waiting for connections...'); // 新增日志
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
    const { userId, password } = data;

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
      onlineUsersIds.set(formattedId, { socketId: socket.id, username: user.username })
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
      onlineUsersIds.set(formattedId, { socketId: socket.id, username: user.username })
      socket.emit('login-success', { userId: formattedId, username: user.username, newToken });

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        socket.emit('error', { message: 'Token已过期，请重新登录' });
      } else {
        socket.emit('error', { message: '登录失败，请稍后再试' });
      }
    }
  });

  socket.on('initial-data-success', async (data) => {
    const { userId } = data;

    const user = await db('users').where({ id: userId }).first(); // 根据ID查找用户
    if (!user) {
      socket.emit('error', { message: '用户ID或密码不正确' });
      return;
    }
    const formattedId = String(user.id).padStart(6, '0');
    handleSendDisconnectMessage(socket, { userId: formattedId, username: user.username });
    handleGetFriendRequests(socket);

    socket.emit('disconnect-messages-sent-success');
  });


  // 处理私聊消息
  socket.on('send-private-message', async (message) => {

    const receiverId = message.receiver_id;

    const senderInfo = onlineUsers.get(socket.id);

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
    const sendMessageId = message.id

    const newMessage = {
      message_id: sendMessageId,
      sender_id: senderInfo.userId,
      receiver_id: receiverUser.id,
      room_id: `private_${Math.min(senderInfo.userId, receiverUser.id)}_${Math.max(senderInfo.userId, receiverUser.id)}`,
      content: message.text,
      timestamp: message.timestamp || new Date(),
      status: 'sent'
    };



    // 存储消息到数据库
    const [messageId] = await db('messages').insert(newMessage);

    const savedMessage = {
      id: sendMessageId,
      username: senderInfo.username,
      content: newMessage.content,
      timestamp: newMessage.timestamp,
      senderId: newMessage.sender_id,
      receiverId: newMessage.receiver_id,
      receiverUsername: receiverUser.username,
      messageType: 'text',
      type: 'private'
    };




    if (onlineUsersIds.has(receiverId)) {
      const targetSocketId = onlineUsersIds.get(receiverId).socketId;
      io.to(targetSocketId).emit('new-message', savedMessage);
      await db('messages').where({ id: messageId }).update({ status: 'delivered' });
    } else {
      // 接收方离线，消息状态保持 'sent' (待投递)
      console.log(`用户 ${receiverUser.username} 离线，消息将等待上线后投递`);
    }

    socket.emit('message-sent-success', { senderInfo, sendMessageId, receiverId, isGroup: false });

  });

  socket.on('send-group-message', async (message) => {
    const senderInfo = onlineUsers.get(socket.id);
    const groupId = message.receiver_id;
    const sendMessageId = message.id

    if (!senderInfo) {
      socket.emit('error', { message: '发送者信息不存在' });
      return;
    }
    if (!groupId) {
      socket.emit('error', { message: '群组ID是必需的' });
      return;
    }

    const group = await db('groups').where({ id: groupId }).first();
    if (!group) {
      socket.emit('error', { message: `群组ID ${groupId} 不存在` });
      return;
    }

    const groupMembers = await db('group_members')
      .where({ group_id: groupId })
      .andWhereNot('user_id', senderInfo.userId)
      .select('user_id');

    const sendTimestamp = new Date();

    const newMessage = {
      group_id: groupId,
      sender_id: senderInfo.userId,
      content: message.text,
      timestamp: sendTimestamp,
      message_id: sendMessageId,
    };


    const savedMessage = {
      id: sendMessageId,
      username: senderInfo.username,
      content: newMessage.content,
      timestamp: sendTimestamp,
      senderId: newMessage.sender_id,
      receiverId: newMessage.group_id,
      type: 'group',
      status: 'success'
    };

    // 存储消息到数据库
    await db('group_messages').insert(newMessage);
    for (const member of groupMembers) {
      if (onlineUsersIds.has(member.user_id)) {
        const targetSocketId = onlineUsersIds.get(member.user_id).socketId;
        io.to(targetSocketId).emit('new-message', savedMessage);
      }
      else {
        await db('group_message_read_status').insert({
          group_message_id: sendMessageId,
          user_id: member.user_id,
          status: 'sent',
          timestamp: sendTimestamp,
        });
      }
    }
    socket.emit('message-sent-success', { senderInfo, sendMessageId, receiverId: group.id, isGroup: true });
  });


  // 获取好友列表
  socket.on('get-friends-list', async () => {
    const friends = await getFriendsList(socket);
    socket.emit('friends-list', friends);
  });

  socket.on('get-groups-list', async () => {
    const groups = await getGroupsList(socket);
    socket.emit('group-list', groups);
  });

  socket.on('get-contacts', async () => {
    const friends = await getFriendsList(socket);
    const groups = await getGroupsList(socket);
    socket.emit('contacts-list', [...friends, ...groups]);
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
      socket.emit('add-friends-msg', { success: false, message: '好友id不可为空' });
      return
    }

    // 用户不能添加自己为好友
    if (senderInfo.userId == friendId) {
      socket.emit('add-friends-msg', { success: false, message: '不能添加自己为好友' });
      return;
    }

    try {
      // 检查是否已经是好友或已发送请求
      const sortedIds = [senderInfo.userId, friendId].sort();
      const friendshipId = `${sortedIds[0]}_${sortedIds[1]}_friends`;

      const existingFriendship = await db('friendships')
        .where('id', friendshipId)
        .first();

      if (existingFriendship) {
        socket.emit('add-friends-msg', { success: false, message: '已经是好友或已发送请求' });
        return;
      }

      await db('friendships').insert({
        id: friendshipId,
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
          id: friendshipId,
          inviterId: senderInfo.userId,
          inviterName: senderInfo.username
        });
      }

      socket.emit('add-friends-msg', { success: true });
    } catch (error) {
      console.error('Error adding friend:', error);
      socket.emit('add-friends-msg', { success: false, message: '添加好友失败' });
    }
  });

  // 删除好友
  socket.on('delete-contact', async (friendId) => {
    const senderInfo = onlineUsers.get(socket.id);
    if (!senderInfo || !friendId) return;

    const sortedIds = [senderInfo.userId, friendId].sort();
    const friendshipId = `${sortedIds[0]}_${sortedIds[1]}_friends`;

    console.log(`删除好友: ${friendshipId}`);

    try {
      await db('friendships')
        .where('id', friendshipId)
        .del();

      socket.emit('contact-deleted', { friendId });
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  });


  // 接受好友请求
  socket.on('accept-friend-request', async (requesterId) => {
    const senderInfo = onlineUsers.get(socket.id);
    if (!senderInfo || !requesterId) return;

    try {
      const updated = await db('friendships')
        .where({ id: requesterId, status: 'pending' })
        .update({ status: 'accepted' });

      if (updated > 0) {
        // 获取好友信息，明确指定是 friendships 表的 id
        const friendInformation = await db('friendships')
          .where({ 'friendships.id': requesterId })
          .join('users', 'friendships.user_id', 'users.id')
          .select('users.id', 'users.username');

        // 通知对方请求已被接受
        const targetSocketId = Array.from(onlineUsers.entries())
          .find(([, uInfo]) => uInfo.userId === requesterId)?.[0];
        if (targetSocketId) {
          io.to(targetSocketId).emit('friend-request-accepted', {
            id: senderInfo.userId,
            username: senderInfo.username,
            type: 'friend',
            isOnline: true
          });
        }
        socket.emit('friend-request-accepted', Object.assign(friendInformation[0], { type: 'friend', isOnline: targetSocketId }));
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  });

  //接受群聊邀请的请求
  socket.on('accept-group-invite', async (requesterId) => {
    const senderInfo = onlineUsers.get(socket.id);
    if (!senderInfo || !requesterId) return;
    try {
      const timestamp = new Date();
      await db('group_invitations')
        .where({ id: requesterId, status: 'pending' })
        .update({ status: 'accepted', update_time: timestamp });
      const newMemberInformation = await db('group_invitations as gi')
        .where({ id: requesterId })
        .join('users', 'group_invitations.invited_user_id', 'users.id')
        .select('gi.group_id as groupId', 'users.id as userId', 'users.username')
        .first();

      await db('group_members').insert({
        group_id: newMemberInformation.groupId,
        user_id: newMemberInformation.userId,
        user_name: newMemberInformation.username,
        created_at: timestamp,
        updated_at: timestamp,
        role: 'member'
      });

      const groupMembers = await db('group_invitations')
        .where({ 'group_invitations.id': requesterId })
        .join('group_members as gm', 'group_invitations.group_id', 'group_members.group_id')
        .select('gm.id');

      groupMembers.map(member => {
        if (onlineUsersIds.get(member.id)) {
          io.to(onlineUsersIds.get(member.id)).emit('new-group-member', {
            id: newMemberInformation.userId,
            username: newMemberInformation.username,
            groupId: newMemberInformation.groupId,
          });
        }
      })
    } catch (error) {
      console.error('Error accepting group invite:', error);
    }
  })

  socket.on('create-group', async ({ checkedContacts }) => {
    const senderInfo = onlineUsers.get(socket.id);
    if (!senderInfo || !checkedContacts || checkedContacts.length === 0) return;

    let groupName = '';
    const nowDate = new Date();

    if (checkedContacts.length < 2) {
      groupName = `${senderInfo.username},${checkedContacts[0].userName}`;
    }
    else {
      groupName = `${senderInfo.username},${checkedContacts.slice(0, 2).map(c => c.userName).join(',')}`;
    }

    if (checkedContacts.length > 2) {
      groupName += `等人`;
    }

    try {
      const maxIdResult = await db('groups').max('id as maxId').first();
      const nextId = (+maxIdResult.maxId || 100000) + 1;
      const group = {
        id: nextId,
        name: groupName + '的群聊',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // 存储群组到数据库（假设有一个 groups 表）
      await db('groups').insert(group);

      await db('group_members').insert([
        {
          group_id: nextId,
          user_id: senderInfo.userId,
          user_name: senderInfo.username,
          created_at: nowDate,
          updated_at: nowDate,
          role: 'owner'
        },
      ]);


      for (const contact of checkedContacts) {
        await db('group_members').insert({
          group_id: nextId,
          user_id: contact.id,
          user_name: contact.userName,
          created_at: nowDate,
          updated_at: nowDate,
          role: 'member'
        });
      }

      socket.emit('grops-create-success');

      const checkedContactIds = [...checkedContacts.map(c => c.id), senderInfo.userId];
      const onlineMemberSockets = Array.from(onlineUsers.entries())
        .filter(([, userInfo]) => checkedContactIds.includes(userInfo.userId))
        .map(([socketId]) => socketId);

      // 向所有在线群成员发送消息
      onlineMemberSockets.forEach(socketId => {
        io.to(socketId).emit('new-group', { id: nextId, username: groupName, createdAt: nowDate, joinedAt: nowDate, type: 'group', members: checkedContacts.map(c => ({ userId: c.id, userName: c.userName })) });
      });
    } catch (error) {
      console.error('Error creating group:', error);
      socket.emit('error', { message: '创建群组失败' });
    }
  });

  socket.on('leave-group', async ({ groupId, userId }) => {
    const senderInfo = onlineUsers.get(socket.id);
    if (!senderInfo || !groupId) return;

    try {
      await db('group_members')
        .where({ group_id: groupId, user_id: userId })
        .del();

      socket.emit('leave-group-success', groupId);
    } catch (error) {
      console.error('Error leaving group:', error);
    }

  });

  socket.on('invite-friends-join-group', async ({ groupId, groupName, checkedContacts }) => {
    const senderInfo = onlineUsers.get(socket.id);
    const nowDate = new Date();
    if (!senderInfo || !groupId || !checkedContacts || checkedContacts.length === 0) return;


    try {
      for (const contact of checkedContacts) {
        const existingMember = await db('group_members')
          .where({ group_id: groupId, user_id: contact.id })
          .first();
        if (existingMember) {
          socket.emit('notification', { status: 'error', message: `${contact.userName} 已是群成员` });
          continue; // 跳过当前联系人，继续处理下一个
        }

        // 生成邀请ID，使用 邀请人id_被邀请人id_群id_group的形式
        const invitationId = `${senderInfo.userId}_${contact.id}_${groupId}_group`;

        // 检查是否已发送邀请
        const existingInvite = await db('group_invitations')
          .where('id', invitationId)
          .first();
        if (existingInvite) {
          socket.emit('notification', { status: 'error', message: `已邀请 ${contact.userName}, 勿重复邀请` });
          continue; // 跳过当前联系人，继续处理下一个
        }

        if (onlineUsersIds.has(contact.id)) {
          // 在线用户直接发送邀请
          const targetSocketId = onlineUsers.get(contact.id).socketId;
          io.to(targetSocketId).emit('group-invite', {
            groupId,
            groupName,
            inviterId: senderInfo.userId,
            inviterName: senderInfo.username
          });
        } else {
          // 离线用户存入数据库
          await db('group_invitations').insert({
            id: invitationId,
            group_id: groupId,
            invited_user_id: contact.id,
            inviting_user_id: senderInfo.userId,
            status: 'pending',
            created_at: nowDate,
            updated_at: nowDate
          });
        }
      }
      socket.emit('notification', { status: 'success', message: `发送请求成功` });
    }

    catch (error) {
      console.error('Error inviting friends to join group:', error);
    }
  });


  // 心跳检测
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
    onlineUsersIds.delete(userInfo?.userId);
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

// 文件下载接口（修改为从MinIO下载）
app.get('/api/download/:fileId/:isGroup', async (req, res) => {
  const { fileId, isGroup } = req.params;

  const isGroupBool = isGroup === 'true';

  try {
    let fileMessage;
    if (isGroupBool) {
      fileMessage = await db('group_messages')
        .where({ file_id: fileId, message_type: 'file' })
        .first();
    }
    else {
      fileMessage = await db('messages')
        .where({ file_id: fileId, message_type: 'file' })
        .first();
    }
    if (!fileMessage) {
      return res.status(404).json({ error: '文件不存在或已被清理' });
    }

    // 从MinIO获取文件流
    const dataStream = await minioClient.getObject(bucketName, fileMessage.file_path);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileMessage.file_name)}"`);
    res.setHeader('Content-Type', fileMessage.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', fileMessage.file_size);

    dataStream.pipe(res);
  } catch (error) {
    console.error('文件下载失败:', error);
    res.status(500).json({ error: '文件下载失败' });
  }
});

// JWT 验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'your_secret_key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- 新的 MinIO 文件上传流程 ---

// 初始化上传，获取预签名URL
app.post('/api/upload/initiate', authenticateToken, (req, res) => {
  const { fileName, senderId, isGroup, receiverId } = req.body;
  if (!fileName || !senderId) {
    return res.status(400).json({ error: '文件名和发送者ID是必需的' });
  }

  const fileId = crypto.randomBytes(8).toString('hex');
  const fileExtension = path.extname(fileName);
  // 在对象名前加上用户ID路径
  const objectName = isGroup ? `group-${receiverId}/files/${fileId}_${Date.now()}${fileExtension}` : `user-${senderId}/files/${fileId}_${Date.now()}${fileExtension}`;

  // 生成一个有效期为15分钟的预签名URL，用于PUT操作
  minioClient.presignedPutObject(bucketName, objectName, 15 * 60, (err, presignedUrl) => {
    if (err) {
      console.error('生成预签名URL失败:', err);
      return res.status(500).json({ error: '无法初始化上传' });
    }
    res.json({
      presignedUrl,
      objectName, // 将生成的对象名返回给客户端
      fileId
    });
  });
});

//完成上传，保存文件元数据
app.post('/api/upload/complete', authenticateToken, async (req, res) => {
  const { fileName, objectName, fileId, fileSize, receiverId, senderId, messageId, isGroup } = req.body;

  if (!fileName || !objectName || !fileId || !fileSize || !receiverId || !senderId) {
    return res.status(400).json({ error: '所有字段都是必需的' });
  }

  try {
    const receiverUser = await db('users').where({ id: receiverId }).first();

    const timestamp = new Date().getTime();

    const newMessage = {
      sender_id: senderId,
      content: `[文件] ${fileName}`,
      message_type: 'file',
      file_name: fileName,
      file_path: objectName, // 存储MinIO中的对象名
      file_url: `/api/download/${fileId}`, // 下载URL保持不变
      file_size: fileSize,
      file_id: fileId,
      timestamp: timestamp,
      message_id: messageId
    };

    const senderUser = await db('users').where({ id: senderId }).first();

    const savedMessage = {
      id: messageId,
      username: senderUser.username,
      content: newMessage.content,
      timestamp: newMessage.timestamp,
      senderId: newMessage.sender_id,
      receiverId: newMessage.receiver_id,
      senderUsername: senderUser.username,
      receiverUsername: receiverUser?.username,
      type: isGroup ? 'group' : 'private',
      messageType: 'file',
      fileName: fileName,
      fileUrl: newMessage.file_url,
      fileSize: fileSize,
      fileId: fileId
    };

    if (isGroup) {
      newMessage.group_id = receiverId;
      await db('group_messages').insert(newMessage)
      const groupMembers = await db('group_members')
        .where({ group_id: receiverId })
        .select('user_id');
      for (const member of groupMembers) {
        if (onlineUsersIds.has(member.user_id)) {
          const targetSocketId = onlineUsersIds.get(member.user_id)?.socketId;
          io.to(targetSocketId).emit('new-group-message', savedMessage);
        }
        else {
          await db('group_message_read_status').insert({
            group_message_id: messageId,
            user_id: member.user_id,
            status: 'sent',
            timestamp: timestamp,
          });
        }
      }
    }
    else {
      newMessage.room_id = `private_${Math.min(senderId, receiverId)}_${Math.max(senderId, receiverId)}`;
      newMessage.receiver_id = receiverId;
      await db('messages').insert(newMessage);
      const targetSocketId = onlineUsersIds.get(receiverId)?.socketId;
      if (targetSocketId) {
        io.to(targetSocketId).emit('new-message', savedMessage);
        await db('messages').where({ id: messageId }).update({ status: 'delivered' });
      } else {
        console.log(`用户 ${receiverUser.username} 离线，文件消息将等待上线后投递`);
      }
    }


    res.status(200).json({ message: '文件记录成功', messageData: savedMessage });


  } catch (error) {
    console.error('完成文件上传失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// --- 新的基于HTTP的头像上传流程 ---

// 1. 初始化上传，获取预签名URL
app.post('/api/avatar/initiate', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const objectName = `user-${userId}/avatar.jpg`; // 固定文件名，方便覆盖

  // 生成一个有效期为5分钟的预签名URL，用于PUT操作
  minioClient.presignedPutObject(bucketName, objectName, 5 * 60, (err, presignedUrl) => {
    if (err) {
      console.error('生成头像上传URL失败:', err);
      return res.status(500).json({ error: '无法初始化头像上传' });
    }
    res.json({
      presignedUrl,
      objectName,
    });
  });
});

// 2. 完成上传，更新数据库
app.post('/api/avatar/complete', authenticateToken, async (req, res) => {
  const { objectName } = req.body;

  if (!objectName) {
    return res.status(400).json({ error: 'ObjectName is required' });
  }

  try {
    res.status(200).json({ message: 'Avatar updated successfully' });
  } catch (error) {
    console.error('完成头像上传处理失败:', error);
    res.status(500).json({ error: '保存头像信息失败' });
  }
});


// 头像下载接口 - 通过userId直接获取头像
app.get('/api/avatar/:userId/:userType', async (req, res) => {
  const { userId, userType } = req.params;

  try {
    if (!userId || typeof userId !== 'string' || !/^[0-9]+$/.test(userId)) {
      return res.status(400).json({ error: '无效的用户ID格式' });
    }

    // 尝试不同的文件扩展名来查找头像文件
    const extension = '.jpg';
    let foundObject = null;

    if (userType == 'user') {
      const user = await db('users').where({ id: userId }).first();
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      try {
        const objectName = `user-${userId}/avatar${extension}`;
        await minioClient.statObject(bucketName, objectName);
        foundObject = objectName;
      } catch {
        const defaultAvatar = await minioClient.getObject(bucketName, 'public-resources/default_avatar.jpg');
        res.setHeader('Content-Type', 'image/jpg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
        return defaultAvatar.pipe(res);
      }
    }
    else {
      const group = await db('groups').where({ id: userId }).first();
      if (!group) {
        return res.status(404).json({ error: '群组不存在' });
      }

      try {
        const objectName = `group-${userId}/avatar${extension}`;
        await minioClient.statObject(bucketName, objectName);
        foundObject = objectName;
      } catch {
        const defaultAvatar = await minioClient.getObject(bucketName, 'public-resources/default_avatar.jpg');
        res.setHeader('Content-Type', 'image/jpg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
        return defaultAvatar.pipe(res);
      }
    }

    // 从MinIO获取头像文件流
    const dataStream = await minioClient.getObject(bucketName, foundObject);

    // 设置适当的缓存头
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 缓存1小时
    res.setHeader('Content-Type', 'image/jpg'); // 默认为jpeg

    dataStream.pipe(res);
  } catch (error) {
    console.error('头像下载失败:', error);
    res.status(500).json({ error: '头像下载失败' });
  }
});


app.get('/api/getGroupMember/:groupId/', authenticateToken, async (req, res) => {
  const { groupId } = req.params;

  const groupMembers = await db('group_members as m')
    .where('m.group_id', groupId)
    .select(
      'm.user_id as userId',
      'm.user_name as userName',
      'm.role as role'
    );

  res.json(groupMembers);
});

// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`聊天室服务器运行在端口 ${PORT}`);
  console.log(`WebSocket 服务已启动`);
});

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

export default app;
