import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import knex from 'knex';
import knexConfig from './knexfile.cjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as Minio from 'minio';
import dotenv from 'dotenv';
import axios from 'axios';

import { decryptMessage, encryptMessage } from './aseOptions.js';
import { registerUser, userLogin, userLoginWithToken } from './userOptions.js';
import { compareContactInformation, compareGroupMemberVersion } from './userContactCompare.js';
import { sendEmailCode } from './sendEmailCode.js';
import {
    getOnlineUser,
    getAllOnlineUsers,
    getAllOnlineUserIds,
    getOnlineUserId,
    removeOnlineUserId,
    removeOnlineUser,
    setEmailCode,
    getEmailCode,
    deleteEmailCode,
    existEmailCooldown,
    retryKey
} from './redisClient.js';
import logger from './logger.js'; // 引入外部日志工具类

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.join(__dirname, 'config.env')
});

const githubConfig = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackUrl: process.env.GITHUB_CALLBACK_URL,
};

const JSON_WEB_TOKEN_SECRET = process.env.JWT || 'your_secret_key'; // 用于签名 JWT





// 根据环境变量选择配置，默认为 'development'
const environment = process.env.NODE_ENV || 'development';
export const db = knex(knexConfig[environment]);


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
export const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            const electronOrigins = [
                'file://',
                'app://',
                'asar://',
                'null'
            ];

            const isElectronOrigin = !origin ||
                electronOrigins.some(electronOrigin =>
                    origin.startsWith(electronOrigin) ||
                    origin === 'null');

            if (isElectronOrigin) {
                callback(null, true);
            } else {
                logger.warn('CORS blocked', { origin });
                callback(new Error('Origin not allowed by CORS'));
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    },
    pingInterval: 25000,
    pingTimeout: 5000,
});

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase the limit to 50mb or adjust as needed


// JWT 验证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        logger.warn('No access token provided', { url: req.url });
        return res.status(401).json({ error: '未提供访问令牌' });
    }

    jwt.verify(token, JSON_WEB_TOKEN_SECRET, (err, user) => {
        if (err) {
            logger.error('JWT verification failed', { error: err.message, name: err.name });
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: '令牌已过期' });
            } else if (err.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: '无效的令牌' });
            }
            return res.status(403).json({ error: '访问被拒绝' });
        }
        req.user = user;
        next();
    });
};

//更新用户联系人列表版本
async function updateUserContactVersion(userId, id) {
    // 使用数据库的自增功能来增加版本号
    await db('users')
        .where('id', userId)
        .update({
            contact_list_version: db.raw(`GREATEST(contact_list_version, ?)`, [id])
        });
}

//更新群成员版本
async function updateGroupMemberVersion(groupId, id) {
    await db('groups')
        .where('id', groupId)
        .update({
            member_version: db.raw(`GREATEST(member_version, ?)`, [id])
        });
}

//更新群消息版本
async function updateGroupMessageVersion(groupId, id) {
    await db('groups')
        .where('id', groupId)
        .update({
            message_version: db.raw(`GREATEST(message_version, ?)`, [id])
        });
}

// 同步群消息
async function syncGroupMessages(socket, groupId, messageVersion) {
    const senderInfo = await getOnlineUser(socket.id);
    if (!senderInfo) {
        socket.emit('notification', { status: 'error', message: '未登录或会话无效' });
        return;
    }

    try {
        let newGroupMessages;
        // 查询messageVersion之后的所有群消息
        if (messageVersion == 0) {
            // 首次同步，限制返回最新的30条消息
            newGroupMessages = await db('group_messages as gm')
                .join('users as u', 'gm.sender_id', 'u.id')
                .where('gm.group_id', groupId)
                .andWhere('gm.id', '>', messageVersion)
                .select(
                    'gm.id',
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
                .limit(30)
                .orderBy('gm.timestamp', 'asc');
        }
        else {
            newGroupMessages = await db('group_messages as gm')
                .join('users as u', 'gm.sender_id', 'u.id')
                .where('gm.group_id', groupId)
                .andWhere('gm.id', '>', messageVersion)
                .select(
                    'gm.id',
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
        }


        // 发送群聊消息
        for (const msg of newGroupMessages) {
            socket.emit('new-message', {
                version_id: msg.id,
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
        }

    } catch (error) {
        console.error('Error syncing group messages:', error);
        socket.emit('notification', { status: 'error', message: '同步群消息失败' });
    }
}

// Fetches and emits the friends list for a given socket
async function getFriendsList(socket) {
    const senderInfo = await getOnlineUser(socket.id)
    if (!senderInfo) {
        socket.emit('notification', { status: 'error', message: '未登录或会话无效' });
        return;
    }

    try {
        const friendships = await db('friendships')
            .where({ user_id: senderInfo.userId, status: 'accepted' })
            .orWhere({ friend_id: senderInfo.userId, status: 'accepted' });

        const friendIds = friendships.map(f => f.user_id === senderInfo.userId ? f.friend_id : f.user_id);

        const friends = await db('users').whereIn('id', friendIds).select('id', 'username', 'inf_version');
        const onlineUserIds = await getAllOnlineUserIds();

        const friendsWithStatus = friends.map(friend => ({
            id: friend.id,
            username: friend.username,
            isOnline: onlineUserIds.has(friend.id),
            type: 'friend',
            version: friend.inf_version
        }));

        const contactVersion = await db('users')
            .where('id', senderInfo.userId)
            .first('contact_list_version');

        return { friendsWithStatus, contactVersion: contactVersion.contact_list_version || -1 };
    } catch (error) {
        console.error('Error fetching friends:', error);
        socket.emit('notification', { status: 'error', message: '获取好友列表失败' });
    }
}

// Fetches and emits the groups list for a given socket
async function getGroupsList(socket) {
    const senderInfo = await getOnlineUser(socket.id);
    if (!senderInfo) {
        socket.emit('notification', { status: 'error', message: '未登录或会话无效' });
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
            'g.updated_at',
            'g.version'
        )
        .orderBy('g.updated_at', 'desc');


    const payload = baseGroups.map(g => ({
        id: g.groupId,
        username: g.groupName,
        myName: g.myName,
        myRole: g.myRole,
        joinedAt: g.joinedAt,
        type: 'group',
        version: g.version
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
    }

    socket.emit('disconnect-message-send-comple', user.userId)
}

async function handleGetFriendRequests(socket) {
    const senderInfo = await getOnlineUser(socket.id);
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
logger.info('Socket.IO server initialized, waiting for connections...');
io.on('connection', (socket) => {
    logger.info('User connected', { socketId: socket.id });

    const originalEmit = socket.emit;
    socket.emit = function (event, data) {
        // 对于敏感事件启用加密
        const sensitiveEvents = ['user-registered', 'login-success', 'new-message'];

        if (sensitiveEvents.includes(event) && data && typeof data === 'object') {
            const encryptedData = encryptMessage(data);
            return originalEmit.call(this, event, encryptedData);
        }

        return originalEmit.apply(this, arguments);
    };

    // 包装socket.on以支持解密
    const originalOn = socket.on;
    socket.on = function (event, handler) {
        const sensitiveEvents = ['register-user', 'login-user', 'send-private-message', 'send-group-message'];

        if (sensitiveEvents.includes(event)) {
            return originalOn.call(this, event, (data) => {
                let decryptedData = data;

                // 如果是加密的消息，先解密
                if (typeof data === 'string' && data.startsWith('ENC$')) {
                    try {
                        decryptedData = decryptMessage(data);

                        // 检查解密结果是否有效
                        if (decryptedData === null) {
                            console.error('解密失败，数据为null');
                            return;
                        }
                    } catch (e) {
                        console.error('解密事件数据失败:', e);
                        return;
                    }
                }

                handler(decryptedData);
            });
        }

        // 对于非敏感事件，直接使用原始处理器
        return originalOn.apply(this, arguments);
    };

    // 用户注册
    socket.on('register-user', (data) => {
        logger.debug('Register user request received', { socketId: socket.id });
        registerUser(socket, data);
    });

    socket.on('login-user', async (data) => {
        logger.debug('Login user request received', { socketId: socket.id });
        userLogin(socket, data);
    });

    socket.on('login-with-token', async (data) => {
        logger.debug('Login with token request received', { socketId: socket.id });
        userLoginWithToken(socket, data);
    });

    socket.on('initial-data-success', async (data) => {
        logger.debug('Initial data success received', { socketId: socket.id });
        let userId;
        // 检查 data 是否为对象以及是否包含 userId
        if (data && typeof data === 'object' && 'userId' in data) {
            userId = data.userId;
        } else if (typeof data === 'string') {
            // 如果数据是字符串（可能是加密的），尝试解密
            try {
                const decrypted = decryptMessage(data);
                userId = decrypted.userId;
            } catch (e) {
                console.error('解析数据失败:', e);
                socket.emit('notification', { status: 'error', message: '数据解析失败' });
                return;
            }
        } else {
            console.error('无法从数据中提取 userId:', data);
            socket.emit('notification', { status: 'error', message: '数据格式错误' });
            return;
        }

        if (!userId) {
            console.error('userId 为空或未定义:', userId);
            socket.emit('notification', { status: 'error', message: '用户ID缺失' });
            return;
        }

        try {
            const user = await db('users').where({ id: userId }).first();
            if (!user) {
                console.error('找不到用户:', userId);
                socket.emit('notification', { status: 'error', message: '用户不存在' });
                return;
            }

            await handleSendDisconnectMessage(socket, { userId: user.id, username: user.username });
            await handleGetFriendRequests(socket);
        } catch (error) {
            logger.error('Error processing initial-data-success', {
                error: error.message,
                stack: error.stack,
                socketId: socket.id
            });
            socket.emit('notification', { status: 'error', message: '处理请求时出错' });
        }
    });

    socket.on('confirm-message-received', async ({ messageId, isGroup }) => {
        if (isGroup) {
            return
        } else {
            await db('messages').where({ message_id: messageId }).update({ status: 'delivered' });
        }
    });


    // 处理私聊消息
    socket.on('send-private-message', async (message) => {
        logger.debug('Send private message request', {
            receiverId: message.receiver_id,
            socketId: socket.id
        });
        const receiverId = message.receiver_id;

        const senderInfo = await getOnlineUser(socket.id);

        if (!senderInfo) {
            socket.emit('notification', { status: 'error', message: '发送者信息不存在' });
            return;
        }
        if (!receiverId) {
            socket.emit('notification', { status: 'error', message: '接收者ID是必需的' });
            return;
        }

        const receiverUser = await db('users').where({ id: receiverId }).first(); // 根据ID查找接收者
        if (!receiverUser) {
            socket.emit('notification', { status: 'error', message: `用户ID ${receiverId} 不存在` });
            return;
        }
        const sendMessageId = message.id

        const newMessage = {
            message_id: sendMessageId,
            sender_id: senderInfo.userId,
            receiver_id: receiverUser.id,
            room_id: `private_${Math.min(senderInfo.userId, receiverUser.id)}_${Math.max(senderInfo.userId, receiverUser.id)}`,
            content: message.text,
            timestamp: new Date(),
            status: 'sent'
        };



        // 存储消息到数据库
        await db('messages').insert(newMessage);

        const savedMessage = {
            message_id: sendMessageId,
            username: senderInfo.username,
            content: newMessage.content,
            timestamp: newMessage.timestamp,
            senderId: newMessage.sender_id,
            receiverId: newMessage.receiver_id,
            receiverUsername: receiverUser.username,
            messageType: 'text',
            type: 'private'
        };

        const onlineUsersIds = await getAllOnlineUserIds();

        if (onlineUsersIds.has(receiverId)) {
            const targetSocketId = onlineUsersIds.get(receiverId).socketId;
            io.to(targetSocketId).emit('new-message', savedMessage);
        } else {
            // 接收方离线，消息状态保持 'sent' (待投递)
            console.log(`用户 ${receiverUser.username} 离线，消息将等待上线后投递`);
        }

        socket.emit('message-sent-success', { senderInfo, sendMessageId, receiverId, isGroup: false });

    });

    socket.on('send-group-message', async (message) => {
        logger.debug('Send group message request', {
            groupId: message.receiver_id,
            socketId: socket.id
        });
        const senderInfo = await getOnlineUser(socket.id);
        const groupId = message.receiver_id;
        const sendMessageId = message.id

        if (!senderInfo) {
            socket.emit('notification', { status: 'error', message: '发送者信息不存在' });
            return;
        }
        if (!groupId) {
            socket.emit('notification', { status: 'error', message: '群组ID是必需的' });
            return;
        }

        const group = await db('groups').where({ id: groupId }).first();
        if (!group) {
            socket.emit('notification', { status: 'error', message: `群组ID ${groupId} 不存在` });
            return;
        }

        const groupMembers = await db('group_members')
            .where({ group_id: groupId })
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
            message_id: sendMessageId,
            username: senderInfo.username,
            content: newMessage.content,
            timestamp: sendTimestamp,
            messageType: 'text',
            senderId: newMessage.sender_id,
            receiverId: newMessage.group_id,
            type: 'group',
            status: 'success'
        };

        const idResult = await db('group_messages').insert(newMessage).returning('id');
        const id = idResult[0].id;

        // 使用原子更新，确保 message_version 始终是最大的消息ID
        await updateGroupMessageVersion(groupId, id)

        socket.emit('message-sent-success', { senderInfo, sendMessageId, receiverId: group.id, isGroup: true, versionId: id });
        const onlineUsersIds = await getAllOnlineUserIds();
        for (const member of groupMembers) {
            if (onlineUsersIds.has(member.user_id) && member.user_id !== senderInfo.userId) {
                const targetSocketId = onlineUsersIds.get(member.user_id).socketId;
                io.to(targetSocketId).emit('new-message', savedMessage);
            }
        }
    });


    socket.on('sync-contacts-list', async ({ version }) => {
        try {
            const senderInfo = await getOnlineUser(socket.id);
            if (version === 0) {
                const result = await getFriendsList(socket);
                const groupResult = await getGroupsList(socket);
                result.groupResult = groupResult;
                socket.emit('const-list', result);
            }
            else {
                const result = await compareContactInformation(senderInfo.userId, version)
                socket.emit('contact-compare-result', result);
            }
        }
        catch (error) {
            console.error('Error getting friends list:', error);
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
        const senderInfo = await getOnlineUser(socket.id);


        if (!friendId) {
            socket.emit('notification', { status: 'error', message: '好友id不可为空' });
            return
        }

        // 用户不能添加自己为好友
        if (senderInfo.userId == friendId) {
            socket.emit('notification', { status: 'error', message: '不能添加自己为好友' });
            return;
        }

        try {
            // 检查是否已经是好友或已发送请求
            const sortedIds = [senderInfo.userId, friendId].sort();
            const friendshipId = `${sortedIds[0]}_${sortedIds[1]}_friends`;

            const existingFriendship = await db('friendships')
                .where('id', friendshipId)
                .first();

            if (existingFriendship && !existingFriendship.is_deleted) {
                socket.emit('notification', { status: 'info', message: '已经是好友或已发送请求' });
                return;
            }

            if (!existingFriendship) {
                await db('friendships').insert({
                    id: friendshipId,
                    user_id: senderInfo.userId,
                    friend_id: friendId,
                    status: 'pending'
                });
            }
            else {
                await db('friendships').update({
                    status: 'pending'
                }).where('id', friendshipId);
            }

            // 查找对方是否在线，以便发送实时通知
            const targetSocketId = await getOnlineUserId(friendId);
            const idResult = await db('user_event')
                .insert({
                    user_id: friendId,
                    action: 'friend_request',
                    event_data: JSON.stringify({
                        id: friendshipId,
                        inviterId: senderInfo.userId,
                        inviterName: senderInfo.username,
                        createdTime: new Date()
                    })
                })
                .returning('id');
            const id = idResult[0].id;
            await updateUserContactVersion(friendId, id);

            if (targetSocketId) {
                io.to(targetSocketId.socketId).emit('contact-update');
            }

            // 改为通用成功通知，或直接不通知（由 contact-update 触发刷新）
            socket.emit('notification', { status: 'success', message: '好友请求已发送' });
        } catch (error) {
            console.error('Error adding friend:', error);
            socket.emit('notification', { status: 'error', message: '添加好友失败' });
        }
    });

    // 删除好友
    socket.on('delete-contact', async (friendId) => {
        const senderInfo = await getOnlineUser(socket.id);
        if (!senderInfo || !friendId) return;

        const sortedIds = [senderInfo.userId, friendId].sort();
        const friendshipId = `${sortedIds[0]}_${sortedIds[1]}_friends`;

        try {
            await db('friendships')
                .where('id', friendshipId)
                .update({ status: 'deleted', is_deleted: true });
            const idResult = await db('user_event')
                .insert({
                    user_id: friendId,
                    action: 'friend_deleted',
                    event_data: JSON.stringify({
                        friendId: senderInfo.userId,
                    })
                })
                .returning('id');
            const id = idResult[0].id;
            await updateUserContactVersion(friendId, id);
            const targetSocketId = await getOnlineUserId(friendId);
            if (targetSocketId) {
                io.to(targetSocketId.socketId).emit('contact-update');
            }

            socket.emit('contact-deleted', { friendId });
        } catch (error) {
            console.error('Error deleting contact:', error);
        }
    });


    // 接受好友请求
    socket.on('accept-friend-request', async (requesterId) => {
        const senderInfo = await getOnlineUser(socket.id);
        if (!senderInfo || !requesterId) return;

        try {
            const updated = await db('friendships')
                .where({ id: requesterId, status: 'pending' })
                .update({ status: 'accepted' });

            if (updated > 0) {
                const { user_id, friend_id } = await db('friendships')
                    .where({ 'friendships.id': requesterId })
                    .select('user_id', 'friend_id')
                    .first();

                const friendInformation = await db('users')
                    .where({ 'users.id': user_id })
                    .select('id', 'username', 'inf_version')
                    .first();
                const senderInformation = await db('users')
                    .where({ 'users.id': friend_id })
                    .select('id', 'username', 'inf_version')
                    .first();

                const idResult = await db('user_event')
                    .insert({
                        user_id: friendInformation.id,
                        action: 'friend_add',
                        event_data: JSON.stringify({
                            status: 'accepted',
                            friend_id: senderInformation.id,
                            username: senderInformation.username,
                            infoVersion: senderInformation.inf_version
                        })
                    })
                    .returning('id');
                const id = idResult[0].id;
                const idResult_2 = await db('user_event')
                    .insert({
                        user_id: senderInformation.id,
                        action: 'friend_add',
                        event_data: JSON.stringify({
                            status: 'accepted',
                            friend_id: friendInformation.id,
                            username: friendInformation.username,
                            infoVersion: friendInformation.inf_version
                        })
                    })
                    .returning('id');
                const id_2 = idResult_2[0].id;
                await updateUserContactVersion(friendInformation.id, id);
                await updateUserContactVersion(senderInformation.id, id_2);

                const targetSocketId = await getOnlineUserId(friendInformation.id);
                const senderSocketId = await getOnlineUserId(senderInformation.id);
                if (targetSocketId) {
                    io.to(targetSocketId.socketId).emit('contact-update');
                }
                if (senderSocketId) {
                    io.to(senderSocketId.socketId).emit('contact-update');
                }
            }
        } catch (error) {
            console.error('Error accepting friend request:', error);
        }
    });

    //接受群聊邀请的请求
    socket.on('accept-group-invite', async (requesterId) => {
        const senderInfo = await getOnlineUser(socket.id);
        if (!senderInfo || !requesterId) return;
        try {
            const timestamp = new Date();
            await db('group_invitations')
                .where({ id: requesterId, status: 'pending' })
                .update({ status: 'accepted', updated_at: timestamp });
            const newMemberInformation = await db('group_invitations as gi')
                .where({ 'gi.id': requesterId })
                .join('users', 'gi.invited_user_id', 'users.id')
                .select('gi.group_id as groupId', 'users.id as userId', 'users.username')
                .first();


            await db('group_members')
                .insert({
                    group_id: newMemberInformation.groupId,
                    user_id: newMemberInformation.userId,
                    user_name: newMemberInformation.username,
                    created_at: timestamp,
                    updated_at: timestamp,
                    role: 'member'
                })
                .onConflict(['group_id', 'user_id'])
                .ignore()
            const idResult = await db('group_member_event')
                .insert({
                    group_id: newMemberInformation.groupId,
                    user_id: newMemberInformation.userId,
                    action: 'group_member_add',
                    event_data: JSON.stringify({
                        status: 'accepted',
                        username: newMemberInformation.username,
                        role: 'member',
                        join_time: timestamp
                    })
                })
                .returning('id');

            const id = idResult[0].id;

            await updateGroupMemberVersion(newMemberInformation.groupId, id);

            const groupMembers = await db('group_invitations')
                .where({ 'group_invitations.id': requesterId })
                .join('group_members as gm', 'group_invitations.group_id', 'gm.group_id')
                .select('gm.user_id');

            const onlineUsersIds = await getAllOnlineUserIds();
            groupMembers.map(member => {
                if (onlineUsersIds.get(member.id)) {
                    io.to(onlineUsersIds.get(member.id)).socketId.emit('group-member-update');
                }
            })
        } catch (error) {
            console.error('Error accepting group invite:', error);
        }
    })

    socket.on('decline-group-invite', async (requesterId) => {
        try {
            await db('group_invitations')
                .where({ id: requesterId, status: 'pending' })
                .update({ status: 'declined' });
        }
        catch (error) {
            console.error('Error declining group invite:', error);
        }
    });

    socket.on('decline-friend-request', async (requesterId) => {
        try {
            await db('friendships')
                .where({ id: requesterId, status: 'pending' })
                .update({ status: 'declined' });
        }
        catch (error) {
            console.error('Error declining friend request:', error);
        }
    });


    socket.on('create-group', async ({ checkedContacts }) => {
        const senderInfo = await getOnlineUser(socket.id);
        if (!senderInfo || !checkedContacts || checkedContacts.length === 0) return;

        let groupName = '';
        const nowDate = new Date();

        if (checkedContacts.length < 2) {
            groupName = `${senderInfo.username},${checkedContacts[0].username}`;
        }
        else {
            groupName = `${senderInfo.username},${checkedContacts.slice(0, 2).map(c => c.username).join(',')}`;
        }

        if (checkedContacts.length > 2) {
            groupName += `等人的群聊`;
        }

        try {
            const maxIdResult = await db('groups').max('id as maxId').first();
            const nextId = (+maxIdResult.maxId || 100000) + 1;
            const group = {
                id: nextId,
                name: groupName,
                created_at: new Date(),
                updated_at: new Date(),
            };

            // 存储群组到数据库（假设有一个 groups 表）
            await db('groups').insert(group);

            await db('group_members').insert({
                group_id: nextId,
                user_id: senderInfo.userId,
                user_name: senderInfo.username,
                created_at: nowDate,
                updated_at: nowDate,
                role: 'owner'
            },
            );

            const idResult = await db('user_event')
                .insert({
                    user_id: senderInfo.userId,
                    action: 'group_added',
                    event_data: JSON.stringify({
                        groupId: nextId,
                        groupName,
                        createdAt: nowDate,
                        joinedAt: nowDate,
                        type: 'group',
                        role: 'owner'
                    })
                })
                .returning('id');
            const id = idResult[0].id;
            await updateUserContactVersion(senderInfo.userId, id);


            for (const contact of checkedContacts) {
                await db('group_members').insert({
                    group_id: nextId,
                    user_id: contact.id,
                    user_name: contact.username,
                    created_at: nowDate,
                    updated_at: nowDate,
                    role: 'member'
                });
                const idResult = await db('user_event').insert({
                    user_id: contact.id,
                    action: 'group_added',
                    event_data: JSON.stringify({
                        groupId: nextId,
                        groupName,
                        createdAt: nowDate,
                        joinedAt: nowDate,
                        type: 'group',
                        role: 'member'
                    })
                }).returning('id');
                const id = idResult[0].id;
                await updateUserContactVersion(contact.id, id);
            }

            socket.emit('grops-create-success');
            socket.emit('notification', { status: 'success', message: `群聊创建成功` });

            const checkedContactIds = [...checkedContacts.map(c => c.id), senderInfo.userId];
            const onlineUsersIds = await getAllOnlineUserIds();
            const onlineMemberSockets = checkedContactIds
                .map(id => onlineUsersIds.get(id)?.socketId)


            // 向所有在线群成员发送消息
            onlineMemberSockets.forEach(socketId => {
                io.to(socketId).emit('contact-update');
            });
        } catch (error) {
            console.error('Error creating group:', error);
            socket.emit('notification', { status: 'error', message: '创建群组失败' });
        }
    });

    socket.on('leave-group', async ({ groupId, userId }) => {
        const senderInfo = await getOnlineUser(socket.id);
        if (!senderInfo || !groupId) return;

        try {
            await db('group_members')
                .where({ group_id: groupId, user_id: userId })
                .del();

            const idResult = await db('group_member_event')
                .insert({
                    group_id: groupId,
                    user_id: userId,
                    action: 'left',
                    created_at: new Date(),
                    event_data: JSON.stringify({
                        groupId,
                        userId,
                        userName: senderInfo.username,
                    })
                })
                .returning('id');

            const id = idResult[0].id;
            await db('groups').where({ id: groupId }).update({
                member_version: id,
            });

            socket.emit('leave-group-success', groupId);
        } catch (error) {
            console.error('Error leaving group:', error);
        }

    });

    socket.on('invite-friends-join-group', async ({ groupId, groupName, checkedContacts }) => {
        const senderInfo = await getOnlineUser(socket.id);
        const nowDate = new Date();
        if (!senderInfo || !groupId || !checkedContacts || checkedContacts.length === 0) return;


        try {
            const onlineUsersIds = await getAllOnlineUserIds();
            for (const contact of checkedContacts) {
                const existingMember = await db('group_members')
                    .where({ group_id: groupId, user_id: contact.id })
                    .first();
                if (existingMember) {
                    socket.emit('notification', { status: 'error', message: `${contact.username} 已是群成员` });
                    continue; // 跳过当前联系人，继续处理下一个
                }

                // 生成邀请ID，使用 邀请人id_被邀请人id_群id_group的形式
                const invitationId = `${senderInfo.userId}_${contact.id}_${groupId}_group`;

                // 检查是否已发送邀请
                const existingInvite = await db('group_invitations')
                    .where('id', invitationId)
                    .andWhere('status', 'pending')
                    .first();
                if (existingInvite) {
                    socket.emit('notification', { status: 'error', message: `已邀请 ${contact.username}, 勿重复邀请` });
                    continue; // 跳过当前联系人，继续处理下一个
                }

                await db('group_invitations')
                    .insert({
                        id: invitationId,
                        group_id: groupId,
                        invited_user_id: contact.id,
                        inviting_user_id: senderInfo.userId,
                        status: 'pending',
                        created_at: nowDate,
                        updated_at: nowDate
                    })
                    .onConflict('id')
                    .merge({
                        status: 'pending',
                        updated_at: nowDate
                    })
                    ;

                const idResult = await db('user_event')
                    .insert({
                        user_id: contact.id,
                        action: 'group_invited',
                        event_data: JSON.stringify({
                            id: invitationId,
                            groupId,
                            groupName,
                            inviterId: senderInfo.userId,
                            inviterName: senderInfo.username,
                            invitedAt: nowDate
                        })
                    })
                    .returning('id');

                const id = idResult[0].id;
                await updateUserContactVersion(contact.id, id);

                if (onlineUsersIds.has(contact.id)) {
                    // 在线用户直接发送邀请
                    const targetSocketId = onlineUsersIds.get(contact.id).socketId;
                    io.to(targetSocketId).emit('contact-update');
                }
            }
            socket.emit('notification', { status: 'success', message: `发送请求成功` });
            socket.emit('invite-friends-join-group-success');
        }

        catch (error) {
            console.error('Error inviting friends to join group:', error);
        }
    });

    socket.on('update-user-info', async (payload) => {
        const userId = (await getOnlineUser(socket.id))?.userId;
        const nowDate = new Date();
        await db('users').where({ id: userId }).update(Object.assign(payload, { updated_at: nowDate })).increment('inf_version', 1);
    })


    // 心跳检测
    socket.on('heartbeat', (payload) => {
        if (payload === 'ping') {
            socket.emit('heartbeat', 'pong');
        }
    });

    // 用户断开连接
    socket.on('disconnect', async () => {
        const userInfo = await getOnlineUser(socket.id);
        if (userInfo) {
            logger.info('User disconnected', {
                username: userInfo.username,
                userId: userInfo.userId,
                socketId: socket.id
            });
        }

        // 清理用户数据
        await removeOnlineUserId(userInfo?.userId);
        await removeOnlineUser(socket.id);
    });

    //音视频通信模块
    socket.on("join-room", async (roomId) => {
        const userInfo = await getOnlineUser(socket.id);
        socket.join(roomId);
        console.log(`${userInfo.username} 加入房间 ${roomId}`);
    });

    socket.on('call-request', async ({ roomId, contactId, offer, callMode }) => {
        const targetId = await getOnlineUserId(contactId);
        const callerUserId = await getOnlineUserId(socket.id);
        if (targetId) {
            socket.to(targetId.socketId).emit('call-request', { callerUserId, callerId: socket.id, roomId, offer, callMode });
        }
        else {
            socket.to(roomId).emit('call-request', { callerUserId, callerId: socket.id, roomId, offer, callMode });
        }
    });

    // 处理offer时指定接收者
    socket.on('offer', ({ roomId, offer, targetId }) => {
        if (targetId) {
            socket.to(targetId).emit('offer', {
                offer,
                senderId: socket.id
            });
        } else {
            socket.to(roomId).emit('offer', {
                offer,
                senderId: socket.id
            });
        }
    });

    // 处理answer时指定接收者
    socket.on('answer', ({ roomId, answer, targetId }) => {
        if (targetId) {
            socket.to(targetId).emit('answer', { answer });
        } else {
            socket.to(roomId).emit('answer', { answer });
        }
    });

    socket.on("ice-candidate", ({ roomId, candidate, targetId }) => {
        console.log('接受', roomId, candidate, targetId)
        if (targetId) {
            socket.to(targetId).emit("ice-candidate", { candidate });
        }
        else {
            socket.to(roomId).emit("ice-candidate", { candidate });
        }
    });

    socket.on('sync-group-messages', async ({ groupId, messageVersion }) => {
        if (!groupId || messageVersion === undefined) {
            socket.emit('notification', { status: 'error', message: '缺少必要参数' });
            return;
        }
        await syncGroupMessages(socket, groupId, messageVersion);
    });

    socket.on('close-video', async ({ roomId, targetId }) => {
        if (targetId) {
            socket.to(targetId).emit('close-video', { roomId });
        }
        else {
            socket.to(roomId).emit('close-video', { roomId });
        }
    })

});

// 静态文件服务（用于文件下载）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// REST API 端点
app.get('/api/health', async (req, res) => {
    const onlineUsers = await getAllOnlineUsers();
    res.json({
        status: 'ok',
        timestamp: new Date(),
        onlineUsersCount: onlineUsers.size,
    });
});

app.get('/api/user-info', authenticateToken, async (req, res) => {
    const { userId } = req.body;
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }
    res.json({
        id: user.id,
        username: user.username,
        infoVersion: user.inf_version,
    });
});

// 文件下载接口（修改为从MinIO下载）
app.get('/api/download/:fileId', authenticateToken, async (req, res) => {
    const { fileId } = req.params;


    try {
        let fileMessage;

        fileMessage = await db('group_messages')
            .where({ file_id: fileId, message_type: 'file' })
            .first();

        if (!fileMessage) {
            fileMessage = await db('messages')
                .where({ file_id: fileId, message_type: 'file' })
                .first();
        }

        if (!fileMessage) {
            return res.status(404).json({ error: '文件不存在或已被清理' });
        }

        let dataStream;
        // 从MinIO获取文件流
        try {
            dataStream = await minioClient.getObject(bucketName, fileMessage.file_path);
        } catch (error) {
            console.error('文件不存在或已被清理:', error);
            return res.status(404).json({ error: '文件不存在或已被清理' });
        }


        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileMessage.file_name)}"`);
        res.setHeader('Content-Type', fileMessage.mime_type || 'application/octet-stream');
        res.setHeader('Content-Length', fileMessage.file_size);

        dataStream.pipe(res);
    } catch (error) {
        console.error('文件下载失败:', error);
        res.status(500).json({ error: '文件下载失败' });
    }
});



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
    const objectName = isGroup
        ? `files/group-${receiverId}/${fileId}_${Date.now()}${fileExtension}`
        : `files/user-${senderId}/${fileId}_${Date.now()}${fileExtension}`;

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

        const timestamp = new Date();

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
            message_id: messageId,
            username: senderUser.username,
            content: newMessage.content,
            senderId: newMessage.sender_id,
            type: isGroup ? 'group' : 'private',
            messageType: 'file',
            fileName: fileName,
            fileUrl: newMessage.file_url,
            fileSize: fileSize,
            fileId: fileId,
            status: 'success',
            timestamp: timestamp
        };

        if (isGroup) {
            newMessage.group_id = receiverId;
            const idResult = await db('group_messages').insert(newMessage).returning('id');
            const id = idResult[0].id;
            await updateGroupMessageVersion(receiverId, id);

            savedMessage.receiverId = receiverId
            const groupMembers = await db('group_members')
                .where({ group_id: receiverId })
                .select('user_id');
            const onlineUsersIds = await getAllOnlineUserIds();
            for (const member of groupMembers) {
                if (onlineUsersIds.has(member.user_id) && member.user_id !== senderId) {
                    const targetSocketId = onlineUsersIds.get(member.user_id)?.socketId;
                    io.to(targetSocketId).emit('new-message', savedMessage);
                }
            }
        }
        else {
            newMessage.room_id = `private_${Math.min(senderId, receiverId)}_${Math.max(senderId, receiverId)}`;
            newMessage.receiver_id = receiverId;
            await db('messages').insert(newMessage);
            const onlineUsersIds = await getAllOnlineUserIds();
            const targetSocketId = onlineUsersIds.get(receiverId)?.socketId;
            if (targetSocketId) {
                io.to(targetSocketId).emit('new-message', savedMessage);
                await db('messages').where({ message_id: messageId }).update({ status: 'delivered' });
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
app.post('/api/avatar/initiate', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { isGroupAvatar, groupId } = req.body;
    let objectName
    if (!isGroupAvatar) objectName = `user-${userId}/avatar.jpg`;
    else {
        const userRole = await db('group_members').where({ group_id: groupId, user_id: userId }).first();
        if (userRole.role !== 'owner') {
            res.status(403).json({ error: '权限不足' });
            return;
        }
        objectName = `group-${groupId}/avatar.jpg`;
    };

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


app.get('/api/avatar/:userId/:userType', async (req, res) => {
    const { userId, userType } = req.params;

    try {
        if (!userId || typeof userId !== 'string' || !/^[0-9]+$/.test(userId)) {
            return res.status(400).json({ error: '无效的用户ID格式' });
        }

        let objectName;
        if (userType === 'user') {
            objectName = `user-${userId}/avatar.jpg`;
        } else {
            objectName = `group-${userId}/avatar.jpg`;
        }

        // 检查文件是否存在
        await minioClient.statObject(bucketName, objectName);

        // 生成预签名URL（有效期24小时）
        const presignedUrl = await minioClient.presignedGetObject(
            bucketName,
            objectName,
            24 * 60 * 60
        );

        res.setHeader('Cache-Control', 'public, max-age=3600'); // 缓存1小时

        res.redirect(presignedUrl);
    } catch (error) {
        const defaultAvatarUrl = await minioClient.presignedGetObject(
            bucketName,
            `public-resources/${userType === 'user' ? 'default_avatar' : 'default_group_avatar'}.png`,
            24 * 60 * 60
        );
        res.redirect(defaultAvatarUrl);
        logger.error('获取头像失败:', error);
    }
});

// 在 chatServer.js 中添加或修改头像下载路由
app.get('/api/avatar/:userId/:userType/download', async (req, res) => {
    const { userId, userType } = req.params;

    try {
        // 验证参数
        if (!userId || !userType) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // 验证用户ID格式
        if (!/^[0-9]+$/.test(userId)) {
            return res.status(400).json({ error: '无效的用户ID格式' });
        }

        // 构建 MinIO 对象名称
        let objectName;
        if (userType === 'user') {
            objectName = `user-${userId}/avatar.jpg`;
        } else if (userType === 'group') {
            objectName = `group-${userId}/avatar.jpg`;
        } else {
            return res.status(400).json({ error: '无效的用户类型' });
        }

        // 检查文件是否存在
        try {
            await minioClient.statObject(bucketName, objectName);
        } catch (error) {
            // 如果头像不存在，返回默认头像
            logger.error('头像下载失败:', { userId, userType, error });
            try {
                const defaultObjectName = 'public-resources/default_avatar.jpg';
                await minioClient.statObject(bucketName, defaultObjectName);

                // 流式传输默认头像
                const dataStream = await minioClient.getObject(bucketName, defaultObjectName);

                // 设置响应头
                res.setHeader('Content-Type', 'image/jpeg');
                res.setHeader('Content-Disposition', 'inline; filename="default_avatar.jpg"');

                // 管道传输数据
                dataStream.pipe(res);
                return;
            } catch (defaultError) {
                console.error('默认头像也不存在:', defaultError);
                return res.status(404).json({ error: '头像文件不存在' });
            }
        }

        // 获取文件流
        const dataStream = await minioClient.getObject(bucketName, objectName);

        // 获取文件元数据
        const stat = await minioClient.statObject(bucketName, objectName);

        // 设置响应头
        res.setHeader('Content-Type', stat.metaData['content-type'] || 'image/jpeg');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="avatar-${userId}.jpg"`);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 缓存1小时
        res.setHeader('ETag', stat.etag);

        // 检查客户端是否支持范围请求（断点续传）
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunksize = (end - start) + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': stat.metaData['content-type'] || 'image/jpeg'
            });

            const partialDataStream = await minioClient.getPartialObject(
                bucketName,
                objectName,
                start,
                chunksize
            );

            partialDataStream.pipe(res);
        } else {
            // 直接流式传输整个文件
            dataStream.pipe(res);
        }

    } catch (error) {
        console.error('头像下载错误:', error);

        if (!res.headersSent) {
            if (error.code === 'NoSuchKey') {
                return res.status(404).json({ error: '头像文件不存在' });
            } else if (error.code === 'InvalidObjectName') {
                return res.status(400).json({ error: '无效的文件名' });
            } else {
                return res.status(500).json({ error: '服务器内部错误' });
            }
        }
    }
});

app.post('/api/getGroupMember', authenticateToken, async (req, res) => {
    const { groupId, memberVersion } = req.body;

    if (!groupId) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    if (memberVersion === 0) {
        const groupMembers = await db('group_members as m')
            .where('m.group_id', groupId)
            .select(
                'm.user_id',
                'm.user_name',
                'm.role',
                'm.created_at as join_time'
            );
        const version = await db('groups').where({ id: groupId }).first('member_version');


        res.json({ groupMembers, version: version.member_version, action: 'get' });
    }
    else {
        const groupMembersWithVersion = await compareGroupMemberVersion(groupId, memberVersion);
        if (!groupMembersWithVersion) {
            return res.status(200).json({ success: '已是最新版本' });
        }
        res.json({ groupMembers: groupMembersWithVersion.memberListChange, version: groupMembersWithVersion.memberVersion, action: 'update' });
    }
});

async function githubCallback(req, res) {
    const { code, state } = req.query;

    if (!code) {
        return res.status(400).send('Missing code');
    }

    try {
        /* 1. 用 code 换 access_token */
        const tokenRes = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: githubConfig.clientId,
                client_secret: githubConfig.clientSecret,
                code
            },
            { headers: { Accept: 'application/json' } }
        );

        const accessToken = tokenRes.data.access_token;

        /* 2. 获取 GitHub 用户信息 */
        const userRes = await axios.get(
            'https://api.github.com/user',
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );

        const githubUser = userRes.data;

        /* 3. 获取邮箱（可能需要） */
        let email = githubUser.email;
        if (!email) {
            const emailRes = await axios.get(
                'https://api.github.com/user/emails',
                {
                    headers: { Authorization: `Bearer ${accessToken}` }
                }
            );
            email = emailRes.data.find(e => e.primary)?.email;
        }

        /* 4. 查找 / 创建用户 */
        let user = await db('users').where({ github_id: githubUser.id }).orWhere({ email }).first();
        let username = githubUser.login;
        let githubId = githubUser.id;
        let formattedId;

        if (!user) {
            await db.transaction(async (trx) => {
                // 使用 FOR UPDATE 锁定行（PostgreSQL/MySQL）
                const lastUser = await trx('users')
                    .orderBy('id', 'desc')
                    .first()
                    .forUpdate();

                const nextId = (parseInt(lastUser?.id || '0', 10)) + 1;
                const formattedId = nextId.toString().padStart(6, '0');

                // 插入新用户
                await trx('users').insert({
                    id: formattedId,
                    username,
                    email,
                    github_id: githubId
                });
            });

            user = {
                id: formattedId,
                username,
            }
        }

        /* 5. 生成 JWT */
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JSON_WEB_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        /* 6. 重定向回前端 */
        res.redirect(`fastshow://login?loginId=${state}&token=${token}`);

    } catch (err) {
        console.error(err);
        res.status(500).send('GitHub Auth Failed');
    }
}

app.get('/api/auth/github/callback', githubCallback);

// 在 chatServer.js 中添加刷新 token 接口
app.post('/api/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
    }

    try {
        const date = jwt.verify(refreshToken, JSON_WEB_TOKEN_SECRET);
        const userId = date.userId;
        const userIsExit = await db('users').where({ id: userId }).first();
        if (!userIsExit) {
            return res.status(401).json({ error: '非法的token' });
        }
        const accessToken = jwt.sign(
            { userId: userId, username: userIsExit.username },
            JSON_WEB_TOKEN_SECRET,
            { expiresIn: '2d' }
        );
        const newRefreshToken = jwt.sign(
            { userId: userId, username: userIsExit.username },
            JSON_WEB_TOKEN_SECRET,
            { expiresIn: '7d' }
        )
        res.json({
            accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: '用户登陆状态已过期，请重新登录' });
        }
    }
});

app.post('/api/get-verification-code', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: '邮箱不能为空' });
        }

        // 简单邮箱格式校验
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: '邮箱格式错误' });
        }

        // 防止频繁请求
        if (await existEmailCooldown(email)) {
            return res.status(429).json({ message: '请求过于频繁，请稍后再试' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await setEmailCode(email, code);
        await sendEmailCode(email, code);
        res.json({ success: true, message: '验证码已发送，请注意查收' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: '验证码发送失败' });
        console.error('验证码发送失败', error);
        logger.error('验证码发送失败', error);
    }
});

app.post('/api/verify-verification-code', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ success: false, message: '参数不完整' });
        }


        const emailCode = await getEmailCode(email);

        if (!emailCode) {
            return res.status(400).json({ success: false, message: '验证码已过期' });
        }

        if (String(emailCode) === String(code)) {
            await deleteEmailCode(email);
            return res.json({ success: true, message: '验证成功' });

        }
        else {
            const { locked, retry } = await retryKey(email);
            if (locked) {
                return res.status(429).json({ success: false, message: '错误次数过多，该邮箱已被锁定，请稍后再试' });
            }
            return res.status(401).json({ success: false, message: '验证码验证错误， 剩余尝试次数: ' + (6 - retry) });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, message: '验证码验证失败' });
        logger.error('验证码验证失败', error);
    }
}
)


// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    logger.info(`聊天室服务器运行在端口 ${PORT}`);
    logger.info('WebSocket 服务已启动');
});

process.on('SIGTERM', () => {
    logger.info('收到 SIGTERM 信号，正在关闭服务器...');
    server.close(() => {
        logger.info('服务器已关闭');
        process.exit(0);
    });
});

// 错误处理
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: String(promise)
    });
});

export default app;
