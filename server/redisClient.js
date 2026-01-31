// redisClient.js
import redis from 'redis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config({
    path: path.join(__dirname, 'config.env')
});


const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

await redisClient.connect();

// Redis键的命名空间
const SOCKET_USER_KEY = 'socket:user';
const USER_SOCKET_KEY = 'user:socket';

// 存储用户信息 (socketId -> { userId, username })
async function setOnlineUser(socketId, userInfo) {
    await redisClient.hSet(SOCKET_USER_KEY, socketId, JSON.stringify(userInfo));
}

// 获取用户信息
async function getOnlineUser(socketId) {
    const userData = await redisClient.hGet(SOCKET_USER_KEY, socketId);
    return userData ? JSON.parse(userData) : null;
}

// 删除用户信息
async function removeOnlineUser(socketId) {
    await redisClient.hDel(SOCKET_USER_KEY, socketId);
}

// 获取所有在线用户
async function getAllOnlineUsers() {
    const allEntries = await redisClient.hGetAll(SOCKET_USER_KEY);
    const users = new Map();

    for (const [socketId, userData] of Object.entries(allEntries)) {
        users.set(socketId, JSON.parse(userData));
    }

    return users;
}

// 存储用户ID与socketId映射 (userId -> { socketId, username })
async function setOnlineUserId(userId, socketInfo) {
    await redisClient.hSet(USER_SOCKET_KEY, userId, JSON.stringify(socketInfo));
}

// 获取用户ID对应的socket信息
async function getOnlineUserId(userId) {
    const socketData = await redisClient.hGet(USER_SOCKET_KEY, userId);
    return socketData ? JSON.parse(socketData) : null;
}

// 删除用户ID映射
async function removeOnlineUserId(userId) {
    await redisClient.hDel(USER_SOCKET_KEY, userId);
}

// 获取所有用户ID映射
async function getAllOnlineUserIds() {
    const allEntries = await redisClient.hGetAll(USER_SOCKET_KEY);
    const userIds = new Map();

    for (const [userId, socketData] of Object.entries(allEntries)) {
        userIds.set(userId, JSON.parse(socketData));
    }

    return userIds;
}


export {
    setOnlineUser,
    getOnlineUser,
    removeOnlineUser,
    getAllOnlineUsers,
    setOnlineUserId,
    getOnlineUserId,
    removeOnlineUserId,
    getAllOnlineUserIds,
};