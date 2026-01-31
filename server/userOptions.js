import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { setOnlineUser, removeOnlineUser, setOnlineUserId, getOnlineUserId, removeOnlineUserId } from './redisClient.js';
import { io, db } from './chatServer.js';

const JSON_WEB_TOKEN_SECRET = process.env.JWT || 'your_secret_key';

export const registerUser = async (socket, data) => {
    const { username, password, email } = data;

    if (!username || !password) {
        socket.emit('notification', { status: 'error', message: '用户名和密码是必需的' });
        return;
    }

    const emailIsExists = await db('users').where('email', email).first();
    if (emailIsExists) {
        socket.emit('notification', { status: 'error', message: '注册邮箱已存在' });
        return;
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // 哈希密码
        let formattedId;

        await db.transaction(async (trx) => {
            // 使用 FOR UPDATE 锁定行（PostgreSQL/MySQL）
            const maxIdResult = await trx('users')
                .max('id as maxId')
                .first()
                .forUpdate();

            const nextId = (+maxIdResult.maxId || 0) + 1;
            formattedId = String(nextId).padStart(6, '0')

            // 插入新用户
            await trx('users').insert({
                id: formattedId,
                username,
                password_hash: hashedPassword,
                email
            });
        });

        socket.emit('user-registered', { userId: formattedId, username });
    } catch (error) {
        console.error('注册用户失败:', error);
        socket.emit('notification', { status: 'error', message: '注册失败，请稍后再试' });
    }
}

export const userLogin = async (socket, data) => {
    const { userId, password } = data;

    if (!userId || !password) {
        socket.emit('notification', { status: 'error', message: '用户ID和密码是必需的' });
        return;
    }

    let user;

    try {
        const result = await db('users').where({ id: userId }).first(); // 根据ID查找用户
        if (!result) {
            user = await db('users').where({ email: userId }).first(); // 根据邮箱查找用户
        } else {
            user = result;
        }

        if (!user) {
            socket.emit('notification', { status: 'error', message: '用户ID或密码不正确' });
            return;
        }


        const isPasswordValid = await bcrypt.compare(password, user.password_hash ?? '');


        if (!isPasswordValid) {
            socket.emit('notification', { status: 'error', message: '用户ID或密码不正确' });
            return;
        }

        const existingSocketInfo = await getOnlineUserId(userId);

        // 检查用户是否已登录
        if (existingSocketInfo) {
            const targetSocketId = existingSocketInfo.socketId;
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) {
                targetSocket.emit('strong-logout-warning', { message: '在其他设备登录,已强制下线' });
            }

            // 清理用户数据
            await removeOnlineUserId(userId);
            await removeOnlineUser(targetSocketId);
        }

        // 登录成功
        const formattedId = String(user.id).padStart(6, '0');
        const token = jwt.sign({ userId: formattedId, username: user.username }, JSON_WEB_TOKEN_SECRET, { expiresIn: '2d' });
        await setOnlineUser(socket.id, { userId: formattedId, username: user.username });
        await setOnlineUserId(formattedId, { socketId: socket.id, username: user.username });
        socket.emit('login-success', { userId: formattedId, username: user.username, token });

    } catch (error) {
        console.error('登录失败:', error);
        socket.emit('notification', { status: 'error', message: '登录失败，请稍后再试' });
    }
}

export const userLoginWithToken = async (socket, data) => {
    const token = data;

    if (!token) {
        socket.emit('notification', { status: 'error', message: '需要提供Token' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JSON_WEB_TOKEN_SECRET);
        const user = await db('users').where({ id: decoded.userId }).first();

        if (!user) {
            socket.emit('notification', { status: 'error', message: '无效的Token' });
            return;
        }

        const userId = decoded.userId;
        const existingSocketInfo = await getOnlineUserId(userId);

        // 检查用户是否已登录
        if (existingSocketInfo) {
            const targetSocketId = existingSocketInfo.socketId;
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) {
                targetSocket.emit('strong-logout-warning', { message: '在其他设备登录,已强制下线' });
            }
            // 清理用户数据
            await removeOnlineUserId(userId);
            await removeOnlineUser(targetSocketId);
        }

        const formattedId = String(user.id).padStart(6, '0');

        const newToken = jwt.sign({ userId: formattedId, username: user.username }, JSON_WEB_TOKEN_SECRET, { expiresIn: '2d' });
        await setOnlineUser(socket.id, { userId: formattedId, username: user.username });
        await setOnlineUserId(formattedId, { socketId: socket.id, username: user.username });
        socket.emit('login-success', { userId: formattedId, username: user.username, token: newToken });

    } catch (error) {
        console.error('登录失败:', error);
        if (error.name === 'TokenExpiredError') {
            socket.emit('notification', { status: 'error', message: 'Token已过期，请重新登录' });
        } else {
            socket.emit('notification', { status: 'error', message: '登录失败，请稍后再试' });
        }
    }
}

