import { app, BrowserWindow, ipcMain, shell, dialog, session, desktopCapturer } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { io } from 'socket.io-client';
import knex from 'knex';
import fs from 'fs';
import apiClient from './api.js';
import axios from 'axios';
import { migrateOldDataIfNeeded, getOrCreateDatabaseKey } from './dbOptions.js';
import { Tray, Menu } from 'electron';
import { snowflake } from './utils/snowFlake.js';
import { protocol } from 'electron';
import logger from './logger.js'; // 引入外部日志工具类

import { v4 as uuidv4 } from 'uuid';

import {
    userCredentialsManager,
    settingsManager,
    dbMigrationManager,
    unreadMessageManager,
    userAssetsManager,
    userMessageDraftManager
} from './userOptions/store.js';

import { initUpdater } from './utils/updater.js';
import { decryptAESMessage } from './utils/decryptAESMessage.js'
import crypto from 'crypto';

//注册监听器函数
import { registerSocketListeners } from './listeners/registerListeners.js'
import { runDatabaseMigrations } from './dbMigrate/running.cjs'
import Database from 'better-sqlite3-multiple-ciphers'
import Client_BetterSQLite3 from 'knex/lib/dialects/better-sqlite3/index.js';
import { getElectronLoginParams, decryptAESKey } from './userOptions/userRSAkeyOptions.js'

// ESM-compliant __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- Socket.IO Main Process Setup --


const configPath = path.join(__dirname, '..', '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));


const isDev = config.NODE_ENV === "development"


const SOCKET_SERVER_URL = (isDev ? config.DEV_SERVER_URL : config.SOCKET_SERVER_URL) || 'http://localhost:3001';
let socket;
let heartbeatInterval;
let reconnectionTimer;
let heartbeatTimeout;
let tray = null;
let mainWindow = null;
let voiceWindow = null;
let currentUserId;
let currentUserToken;
class CipherClient extends Client_BetterSQLite3 {
    _driver() {
        return Database;
    }

    async acquireRawConnection() {
        const conn = new Database(
            this.connectionSettings.filename
        );

        conn.pragma(`key='${this.connectionSettings.dbKey}'`);

        // 验证解密是否成功
        conn.prepare(
            "SELECT count(*) FROM sqlite_master"
        ).get();

        return conn;
    }
}


protocol.registerSchemesAsPrivileged([
    {
        scheme: 'file',
        privileges: {
            secure: true,
            standard: true,
            supportFetchAPI: true,
            corsEnabled: true,
            allowServiceWorkers: true,
        }
    }
]);


function connectSocket() {
    logger.info('Attempting to connect to socket server', { url: SOCKET_SERVER_URL });

    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    if (heartbeatTimeout) {
        clearTimeout(heartbeatTimeout);
        heartbeatTimeout = null;
    }
    if (reconnectionTimer) {
        clearTimeout(reconnectionTimer);
        reconnectionTimer = null;
    }

    socket = io(SOCKET_SERVER_URL, {
        reconnection: false,
    });

    socket.onAny((event, ...args) => {
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('socket-event', { event, args });
        });
    });

    // Add a listener for connection errors
    socket.on('connect_error', (err) => {
        logger.error('Socket connection error in main process:', {
            message: err.message,
            stack: err.stack
        });
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('socket-event', { event: 'connect_error', args: [err.message] });
        });
        if (!reconnectionTimer) {
            reconnectionTimer = setTimeout(connectSocket, 5000);
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('socket-event', { event: 'reconnecting' });
            });
            logger.warn('Scheduled socket reconnection', { delayMs: 5000 });
        }
    });

    socket.on('connect', () => {
        logger.info('Socket connected successfully', { id: socket.id });
        if (reconnectionTimer) {
            clearTimeout(reconnectionTimer);
            reconnectionTimer = null;
        }
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('socket-event', { event: 'connect', id: socket.id });
        });

        if (currentUserToken && tray) {
            socket.emit('login-with-token', currentUserToken);
        }

        // Start heartbeat
        heartbeatInterval = setInterval(() => {
            heartbeatTimeout = setTimeout(() => {
                if (socket) {
                    socket.disconnect();
                    logger.warn('Heartbeat timeout - disconnecting socket');
                }
            }, 2000); // Assume timeout if no pong in 2 seconds
            socket.emit('heartbeat', 'ping');
        }, 5000); // Send ping every 5 seconds
    });

    socket.on('disconnect', () => {
        logger.warn('Socket disconnected');
        clearInterval(heartbeatInterval);
        clearTimeout(heartbeatTimeout);

        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('socket-event', { event: 'disconnect' });
        });

        // Attempt to reconnect after a delay
        reconnectionTimer = setTimeout(connectSocket, 5000);
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('socket-event', { event: 'reconnecting' });
        });
        logger.info('Scheduled socket reconnection after disconnect', { delayMs: 5000 });
    });

    socket.on('heartbeat', (payload) => {
        if (payload === 'pong') {
            clearTimeout(heartbeatTimeout); // Pong received, clear timeout
        }
    });
}
// --- End Socket.IO Setup ---

let dbPath;
let db;

export function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Please initialize the database first.');
    }
    return db;
}

export function getCurUserId() {
    return currentUserId;
}

// 读取指定联系人的聊天记录
async function readChatHistory(
    contactId,
    currentUserID,
    pageSize = 20,
    isGroup,
    beforeTimestamp = null
) {
    try {
        const tableName = isGroup ? 'group_messages' : 'messages';

        let query = db(tableName).select('*');

        if (isGroup) {
            query = query.where('receiver_id', String(contactId));
        } else {

            query = query.where(function () {
                this.where(function () {
                    this.where('sender_id', String(currentUserID))
                        .andWhere('receiver_id', String(contactId));
                }).orWhere(function () {
                    this.where('sender_id', String(contactId))
                        .andWhere('receiver_id', String(currentUserID));
                });
            });
        }
        if (beforeTimestamp) {
            query = query.where('timestamp', '<', beforeTimestamp);
        }

        const history = await query
            .orderBy('timestamp', 'desc')
            .limit(pageSize);

        history.forEach(message => {
            message.timestamp = new Date(message.timestamp).getTime();
        });

        history.sort((a, b) => {
            return b.timestamp - a.timestamp;
        });


        return history.reverse();
    } catch (error) {
        console.error(`Failed to read chat history for contact ${contactId}:`, error);
        return [];
    }
}

async function updateContactLastMessagetimestamp(contactId, isGroup) {
    try {
        if (isGroup) {
            await db('groups')
                .where('id', contactId)
                .update({ lastMessage: new Date() });
        } else {
            await db('friends')
                .where('id', contactId)
                .update({ lastMessage: new Date() });
        }
    } catch (error) {
        console.error(`Failed to update last message timestamp for contact ${contactId}:`, error);
    }
}

// 写入指定联系人的聊天记录
async function writeChatHistory(contactId, msg) {
    try {

        const messageData = {
            id: msg.id,
            sender_id: msg.sender == 'user' ? currentUserId : msg.sender_id,
            receiver_id: msg.sender == 'user' ? contactId : (msg.type == 'private' ? currentUserId : contactId),
            text: msg.text || '',
            username: msg.username || '',
            timestamp: msg.timestamp || Date().now(),
            sender: msg.sender || 'user',
            messageType: msg.messageType || 'text',
            fileName: msg.fileName || null,
            fileUrl: msg.fileUrl || null,
            fileSize: msg.fileSize || null,
            fileExt: msg.fileExt || false,
            localFilePath: msg.localPath || null,
            status: msg.status || 'fail',
        };
        if (msg.type == 'private') {
            await db('messages').insert(messageData).onConflict('id').ignore();
        }
        else {
            await db('group_messages').insert(messageData).onConflict('id').ignore();
            await db('groups')
                .where('id', contactId)
                .update({
                    message_version: db.raw('COALESCE(message_version, 0) + 1')
                });
        }

        await updateContactLastMessagetimestamp(contactId, msg.type == 'group');

    } catch (error) {
        logger.error(`Failed to write chat history for contact ${contactId}`, {
            error: error.message,
            stack: error.stack,
            code: error.code,
            errno: error.errno,
            sql: error.sql,
            bindings: error.bindings
        });
        throw error; // 重新抛出错误以便调用方处理
    }
}
// table.string('id').primary();
// table.integer('sender_id').unsigned().references('id').inTable('users').notNullable();
// table.integer('receiver_id').unsigned().references('id').inTable('users').notNullable();
// table.text('text').notNullable();
// table.timestamp('timestamp').defaultTo(db.fn.now());
// table.string('username').notNullable();
// table.string('sender').notNullable().defaultTo('user');
// table.string('messageType').defaultTo('text')
// table.string('fileName').nullable()
// table.string('fileUrl').nullable()
// table.string('fileSize').nullable()


let settingsWindow = null;
function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    const parentWindow = BrowserWindow.getFocusedWindow() || mainWindow;
    const parentBounds = parentWindow.getBounds();
    const width = 500;
    const height = 400;

    const x = Math.round(parentBounds.x + (parentBounds.width - width) / 2);
    const y = Math.round(parentBounds.y + (parentBounds.height - height) / 2);

    settingsWindow = new BrowserWindow({
        width: width,
        height: height,
        x,
        y,
        parent: parentWindow,
        modal: true,
        frame: false,
        webPreferences: {
            preload: path.join(app.getAppPath(), "src", "electron", "preload.js"),
            devTools: isDev
        }
    });
    const settingsUrl = isDev
        ? `http://localhost:5234/settings.html`
        : `file://${path.join(app.getAppPath(), "dist", "settings.html")}`;

    settingsWindow.loadURL(settingsUrl).catch(err => console.error('Failed to load settings URL:', err));

    if (isDev) {
        settingsWindow.webContents.openDevTools();
    }

    settingsWindow.setMenu(null);
    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

let searchWindow = null;
function createSearchWindow(userId, selectInformation) {
    if (searchWindow) {
        searchWindow.focus();
        return;
    }

    const parentWindow = BrowserWindow.getFocusedWindow() || mainWindow;
    const parentBounds = parentWindow.getBounds();
    const width = 500;
    const height = 400;

    const x = Math.round(parentBounds.x + (parentBounds.width - width) / 2);
    const y = Math.round(parentBounds.y + (parentBounds.height - height) / 2);

    searchWindow = new BrowserWindow({
        width: width,
        height: height,
        x,
        y,
        parent: parentWindow,
        modal: true,
        frame: false,
        webPreferences: {
            preload: path.join(app.getAppPath(), "src", "electron", "preload.js"),
            devTools: isDev
        }
    });

    const searchUrl = isDev
        ? `http://localhost:5234/search.html?userId=${userId}&selectInformation=${selectInformation}`
        : `file://${path.join(app.getAppPath(), "dist", "search.html")}?userId=${userId}&selectInformation=${selectInformation}`;

    searchWindow.loadURL(searchUrl).catch(err => console.error('Failed to load search URL:', err));

    if (isDev) {
        searchWindow.webContents.openDevTools();
    }

    searchWindow.setMenu(null);

    searchWindow.on('closed', () => {
        searchWindow = null;
    });
}

function createTray(mainWindow) {
    if (tray) {
        return;
    }

    let trayIconPath;
    if (isDev) {
        trayIconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
    } else {
        // 托盘图标使用与主窗口相同的路径策略
        const resourceIconPath = path.join(process.resourcesPath, 'build', 'icon.png');
        if (fs.existsSync(resourceIconPath)) {
            trayIconPath = resourceIconPath;
        } else {
            const appIconPath = path.join(app.getAppPath(), 'build', 'icon.png');
            if (fs.existsSync(appIconPath)) {
                trayIconPath = appIconPath;
            } else {
                const unpackedIconPath = path.join(app.getAppPath(), 'resources', 'app.asar.unpacked', 'build', 'icon.png');
                if (fs.existsSync(unpackedIconPath)) {
                    trayIconPath = unpackedIconPath;
                } else {
                    console.warn('Tray icon file not found');
                    trayIconPath = null;
                }
            }
        }
    }

    if (!trayIconPath || !fs.existsSync(trayIconPath)) {
        console.warn('Tray icon file not found:', trayIconPath);
        return; // 如果托盘图标不存在，则不创建托盘
    }

    tray = new Tray(trayIconPath);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示应用',
            click: () => {
                mainWindow.show();
                mainWindow.setSkipTaskbar(false);
            }
        },
        {
            label: '退出',
            click: () => {
                app.quitting = true;
                socket.disconnect();
                app.quit();
            }
        }
    ]);

    tray.setToolTip('FastShow');
    tray.setContextMenu(contextMenu);

    // 点击托盘图标显示应用或聚焦
    tray.on('click', () => {
        if (!mainWindow.isVisible()) {
            mainWindow.show();
            mainWindow.setSkipTaskbar(false);
        } else {
            mainWindow.focus();
        }
    });
}

function createMainWindow() {
    let iconPath;
    if (isDev) {
        // 开发环境：直接使用项目根目录下的 build 文件夹
        iconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
    } else {
        // 生产环境：有多种可能的路径
        // 首先尝试 process.resourcesPath（这是最常见的情况）
        const resourceIconPath = path.join(process.resourcesPath, 'build', 'icon.png');
        if (fs.existsSync(resourceIconPath)) {
            iconPath = resourceIconPath;
        } else {
            // 如果上面的路径不存在，尝试 app.getAppPath()
            const appIconPath = path.join(app.getAppPath(), 'build', 'icon.png');
            if (fs.existsSync(appIconPath)) {
                iconPath = appIconPath;
            } else {
                // 最后尝试在 app.asar.unpacked 目录中查找
                const unpackedIconPath = path.join(app.getAppPath(), 'resources', 'app.asar.unpacked', 'build', 'icon.png');
                if (fs.existsSync(unpackedIconPath)) {
                    iconPath = unpackedIconPath;
                } else {
                    console.warn('Icon file not found in any expected location');
                    iconPath = null;
                }
            }
        }
    }

    // 确保图标文件存在，否则不设置图标
    if (iconPath && !fs.existsSync(iconPath)) {
        console.warn('Icon file not found:', iconPath);
        iconPath = null;
    }

    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        minHeight: 300,
        minWidth: 400,
        frame: false,
        icon: iconPath,
        webPreferences: {
            preload: path.join(app.getAppPath(), "src", "electron", "preload.js"),
            devTools: isDev
        }
    });

    if (isDev) {
        mainWindow.loadURL(`http://localhost:5234`);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
    }
    mainWindow.setMenu(null);



    // 显示时恢复任务栏图标
    mainWindow.on('show', () => {
        mainWindow.setSkipTaskbar(false);
    });

    // 处理窗口关闭事件（点击关闭按钮隐藏到托盘）
    mainWindow.on('close', (event) => {
        BrowserWindow.getAllWindows().forEach(win => {
            if (win !== mainWindow) {
                win.close();
            }
        });
        if (!app.quitting) {
            event.preventDefault();
            mainWindow.setSkipTaskbar(true);
            mainWindow.hide();
        }
    });
    initUpdater(mainWindow);
}

async function downLoadUserAvatar() {
    try {

        if (userAssetsManager.getUserAssets(currentUserId, 'avatarPath')) {
            return
        }

        const userDbPath = path.join(app.getPath('userData'), `${currentUserId}`, 'avatar');

        // 确保目录存在
        if (!fs.existsSync(userDbPath)) {
            fs.mkdirSync(userDbPath, { recursive: true }); // 创建 avatar 目录
        }

        const avatarFilePath = path.join(userDbPath, 'avatar.jpg'); // 完整的文件路径

        // 检查文件是否存在，而不是目录
        if (fs.existsSync(avatarFilePath)) {
            return avatarFilePath; // 返回文件路径
        }

        const avatarUrl = `api/avatar/${currentUserId}/user/download`;

        // 发起请求获取头像
        const response = await apiClient.get(avatarUrl, {
            responseType: 'arraybuffer',
            timeout: 10000
        });

        // 保存头像到本地文件
        fs.writeFileSync(avatarFilePath, response.data);

        userAssetsManager.setUserAssets(currentUserId, 'avatarPath', avatarFilePath)

    } catch (error) {
        console.error('下载头像失败:', error);
        return null; // 返回 null 而不是错误对象
    }
}

// 在应用退出前清理
app.on('before-quit', () => {
    app.quitting = true;
});


app.whenReady().then(() => {

    logger.info('Application is ready. Creating windows and initializing components.');

    protocol.registerFileProtocol('avatar', (request, callback) => {
        const filePath = decodeURI(request.url.replace('avatar://', ''));
        callback(filePath);
    });

    // --- Socket.IO Connection ---
    connectSocket();
    // --- End Socket.IO Connection ---

    createMainWindow()

    loginMap.set(loginId, {
        windowId: mainWindow.id,
        status: 'pending'
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            logger.info('App activated with no windows. Creating main window.');
            createMainWindow()
        }
    })
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            callback({ video: sources[0], audio: 'loopback' })
        })
    }, { useSystemPicker: true })
})

// IPC handlers for custom window controls
ipcMain.on('minimize-window', () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
        // 最小化到任务栏：保留任务栏图标
        window.setSkipTaskbar(false);
        window.minimize();
    }
});

ipcMain.on('maximize-window', () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
        if (window.isMaximized()) {
            window.unmaximize();
        } else {
            window.maximize();
        }
    }
});

ipcMain.on('close-window', () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window && !app.quitting) {
        if (window === mainWindow && !tray) {
            socket.disconnect();
            app.quit();
        } else {
            window.close();
        }
    }
    else {
        app.quit();
    }
});

ipcMain.on('close-voice-call', () => {
    if (voiceWindow) {
        voiceWindow.close();
        voiceWindow = null;
    }
})

ipcMain.on('resize-window', (event, { width, height }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.setSize(width, height, true); // true for animation
    }
});


ipcMain.on('toggle-always-on-top', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender); // 确保操作的是发送消息的窗口
    if (window) {
        const isAlwaysOnTop = !window.isAlwaysOnTop();
        window.setAlwaysOnTop(isAlwaysOnTop);
        event.sender.send('always-on-top-changed', isAlwaysOnTop);
    }
});

ipcMain.handle('get-initial-always-on-top', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        return window.isAlwaysOnTop();
    }
    return false;
});


function getUserDbPath(userId) {
    if (!userId) {
        throw new Error('User ID is not set. Cannot determine database path.');
    }
    return path.join(app.getPath('userData'), `${userId}`);
}



ipcMain.on('login-success', async (event, { userId, username, token, email }) => {
    logger.info('Login success received', { userId, username, email });
    currentUserId = userId;
    currentUserToken = token;

    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('init-start');
    });


    try {
        const userDbPath = getUserDbPath(userId);
        dbPath = path.join(userDbPath, 'secure.db');

        if (!fs.existsSync(userDbPath)) {
            fs.mkdirSync(userDbPath, { recursive: true });
        }

        //如果本地为旧数据库， 迁移至新的加密的数据库
        const dbKey = getOrCreateDatabaseKey(userDbPath);
        console.log(`dbKey:${dbKey}`)
        migrateOldDataIfNeeded(userDbPath, dbKey);


        //数据库迁移函数
        const dbInstance = new Database(dbPath);
        dbInstance.pragma(`key='${dbKey}'`);
        try {
            runDatabaseMigrations(dbInstance);
        } catch (migError) {
            console.error('[DB] 迁移脚本执行中途崩溃:', migError);
            throw migError;
        } finally {
            dbInstance.close();
            console.log('[DB] 原生迁移连接已安全关闭。');
        }



        db = knex({
            client: CipherClient,
            connection: {
                filename: dbPath,
                dbKey: dbKey
            },
            useNullAsDefault: true
        });

        try {
            // 这条语句会强制 Knex 立刻从连接池里取一条连接，从而必然走完 afterCreate 钩子
            await db.raw("PRAGMA integrity_check;");
            console.log('--- 2. [Knex] 数据库握手及加锁状态验证通过！ ---');
        } catch (error) {
            console.error('数据库验证失败，密钥可能错误或文件损坏:', error);
            throw error;
        }
        await registerSocketListeners(socket, db);

        createTray(mainWindow);
        socket.on('new-message', handleNewMessage)
        const { device_id, device_name, identity_public_key } = getElectronLoginParams(userDbPath);

        const response = await new Promise((resolve, reject) => {
            socket.timeout(5000).emit('login-info', { device_id, device_name, identity_public_key }, (err, res) => {
                if (err) {
                    reject(err);
                    return
                } else {
                    resolve(res);
                }
            });
        });
        if (!response.success) {
            throw new Error(response.message);
        }

        event.sender.send('db-initialized-success', { userId, username, token, email });
        event.sender.send('start-revice-message');


        await downLoadUserAvatar();
    }
    catch (error) {
        logger.error('Error in login-success handler:', {
            error: error.message,
            code: error.code,
            errno: error.errno,
            sql: error.sql,
            bindings: error.bindings
        });
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('login-failed', { error: error.message });
        });
    }
})




ipcMain.on('start-revice-message', async (event, userId) => {
    const userContactListVersion = userCredentialsManager.getUserContactListVersion(userId);

    socket.emit('initial-data-success', { userId });
    socket.emit('sync-contacts-list', { version: userContactListVersion });
})

ipcMain.handle('get-user-avatar-path', () => {
    return userAssetsManager.getUserAssets(currentUserId, 'avatarPath')
})


ipcMain.handle('save-avatar-locally', async (event, avatarArrayBuffer) => {
    try {
        // 获取当前用户ID
        const userId = currentUserId;
        if (!userId) {
            throw new Error('用户未登录');
        }

        // 创建头像目录
        const userAvatarDir = path.join(app.getPath('userData'), `${userId}`, 'avatar');
        if (!fs.existsSync(userAvatarDir)) {
            fs.mkdirSync(userAvatarDir, { recursive: true });
        }

        // 将 ArrayBuffer 转换为 Buffer 并保存
        const buffer = Buffer.from(avatarArrayBuffer);
        const avatarPath = path.join(userAvatarDir, `avatar${Date.now()}.jpg`);
        fs.writeFileSync(avatarPath, buffer);

        // 更新用户资产管理器
        userAssetsManager.setUserAssets(userId, 'avatarPath', avatarPath);

        const normalizedPath = avatarPath.replace(/\\/g, '/');
        const avatarUrl = `avatar:///${encodeURI(normalizedPath)}`;

        event.sender.send('avatar-saved-successfully', avatarUrl);

        return { success: true, path: avatarPath };
    } catch (error) {
        console.error('保存头像到本地失败:', error);
        return { success: false, error: error.message };
    }
});



const saveNewMessage = async ({ contactId, msg }) => {
    const [messageId, isGroup] = [msg.id, msg.type === 'group']
    if (!msg) {
        console.error('Received chat-message with undefined msg object.');
        return;
    }

    await writeChatHistory(contactId, msg);
    socket.emit('confirm-message-received', { messageId, isGroup });
    unreadMessageManager.incrementUnreadMessageCount(currentUserId, contactId, isGroup);
    shell.beep();
}

const handleNewMessage = async (msg) => {
    // Safety check: Do not process messages if the user is not logged in.

    const isGroup = msg.type == 'group'

    const contactId = isGroup ? msg.receiverId : msg.senderId;
    const messageId = msg.message_id;
    const versionId = msg.version_id || null;

    // 群聊消息会群发给所有成员包括发送者，跳过已存在的消息避免重复处理
    const tableName = isGroup ? 'group_messages' : 'messages';
    const existing = await db(tableName).where({ id: messageId }).first();
    if (existing) return;

    const iv = msg.iv
    let contactAesKey = isGroup
        ? await db('groups').where({ id: contactId }).first('group_aes_key').then(row => row?.group_aes_key)
        : await db('friends').where({ id: contactId }).first('session_aes_key').then(row => row?.session_aes_key)
    if (!contactAesKey) {
        if (!isGroup) {
            const [minId, maxId] = [msg.receiverId, msg.senderId].sort();
            const friendShipId = `${minId}_${maxId}_friends`;
            contactAesKey = getFriendAesKey(friendShipId, msg.senderId)
        }
        else {
            const { AesKey, AseVersion } = await getGroupAesKey(contactId)
            contactAesKey = AesKey
        }

    }
    const decryptMessage = iv ? decryptAESMessage(msg.content, contactAesKey, iv) : msg.content

    const newMessage = {
        id: messageId,
        text: decryptMessage,
        sender: msg.senderId == currentUserId ? 'user' : 'other',
        sender_id: msg.senderId,
        timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
        username: msg.username,
        fileName: msg.fileName,
        messageType: msg.messageType,
        type: msg.type,
        fileUrl: msg.fileUrl,
        fileSize: msg.fileSize,
        versionId,
        status: 'success'
    }

    const renderNewMessage = {
        id: messageId,
        text: decryptMessage,
        sender: currentUserId === msg.senderId ? 'user' : 'other',
        timestamp: msg.timestamp,
        username: msg.username,
        messageType: msg.messageType,
        fileName: msg.fileName,
        fileUrl: msg.fileUrl,
        fileSize: msg.fileSize,
        sender_id: msg.senderId,
        type: msg.type,
        receiverId: msg.receiverId,
        senderId: msg.senderId
    };

    await saveNewMessage({ contactId, msg: newMessage });
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('received-new-chat-message', { contactId, isGroup: msg.type === 'group', renderNewMessage });
    })
}


function getNewMessageId() {
    return snowflake.nextId().toString();
}

ipcMain.handle('get-new-message-id', async () => {
    return getNewMessageId();
})

function encrypt(text, key, iv) {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

async function getFriendAesKey(friendShipId, receiverId) {
    const userDbPath = getUserDbPath(currentUserId);
    const { device_id } = getElectronLoginParams(userDbPath)
    const response = await apiClient.post(`api/getFriendAESKey`, {
        friendShipId,
        deviceId: device_id
    });
    const { encryptedAESKey } = response.data;
    const AesKey = decryptAESKey(encryptedAESKey, userDbPath)
    await db('friends').where({ id: receiverId }).update({ session_aes_key: AesKey })
    return AesKey
}

ipcMain.on('send-private-message', async (event, { receiverId, message, messageId }) => {

    const iv = crypto.randomBytes(16);
    const row = await db('friends')
        .where('id', receiverId)
        .first('session_aes_key');

    let aesKey = row?.aes_key;

    if (!aesKey) {
        try {
            const [minId, maxId] = [currentUserId, receiverId].sort();
            const friendShipId = `${minId}_${maxId}_friends`;
            aesKey = await getFriendAesKey(friendShipId, receiverId)

        } catch (error) {
            console.error('Failed to fetch AES key for friend:', receiverId, error);
            return;
        }
    }

    const fullMessage = {
        ...message,
        id: messageId,
        receiver_id: receiverId,
        timestamp: Date.now(),
        sender: 'user',
    };

    await writeChatHistory(receiverId, fullMessage);

    fullMessage.text = encrypt(message.text, Buffer.from(aesKey, 'hex'), iv);
    fullMessage.iv = iv.toString('hex')

    socket.emit('send-private-message', fullMessage);
    event.sender.send('sent-new-message', { contactId: receiverId, isGroup: false });
});

async function getGroupAesKey(groupId) {
    const userDbPath = getUserDbPath(currentUserId);
    const { device_id } = getElectronLoginParams(userDbPath)
    const response = await apiClient.post(`api/getGroupAes`, {
        groupId,
        deviceId: device_id
    });
    const { encryptedAESKey, aseVersion } = response.data;
    const AesKey = decryptAESKey(encryptedAESKey, userDbPath)
    await db('groups').where({ id: groupId }).update({ group_aes_key: AesKey })
    await db('group_aes_history').insert({ group_id: groupId, aes_key: AesKey, aes_version: aseVersion })

    return { AesKey, AseVersion: aseVersion }
}


ipcMain.on('send-group-message', async (event, { groupId, message, messageId }) => {
    const iv = crypto.randomBytes(16);
    const groupAesKey = await db('groups').where({ id: groupId }).first()
    let aesKey = groupAesKey.group_aes_key;
    let aesVersion = groupAesKey.aes_version;
    if (!aesKey) {
        try {
            const { AesKey, AseVersion } = await getGroupAesKey(groupId)
            aesKey = AesKey
            aesVersion = AseVersion
        }
        catch (error) {
            console.error('Failed to fetch AES key for group:', error);
            return;
        }
    }
    const fullMessage = {
        ...message,
        id: messageId,
        receiver_id: groupId,
        timestamp: Date.now(),
        sender: 'user',
    };
    await writeChatHistory(groupId, fullMessage);

    fullMessage.text = encrypt(message.text, Buffer.from(aesKey, 'hex'), iv);
    fullMessage.iv = iv.toString('hex')
    fullMessage.ase_version = aesVersion

    socket.emit('send-group-message', fullMessage);
    event.sender.send('sent-new-message', { contactId: groupId, isGroup: true });
});


ipcMain.on('message-sent-status', async (event, { sendMessageId, isGroup, versionId }) => {
    try {
        if (!db) {
            console.error('Database not connected, cannot update message status.');
            return;
        }
        //改变私聊信息状态
        if (!isGroup) {
            await db('messages')
                .where('id', sendMessageId)
                .update({ status: 'success' });
        }
        //改变群聊信息状态
        else {
            await db('group_messages')
                .where('id', sendMessageId)
                .update({ status: 'success' });
            const row = await db('group_messages')
                .join('groups', 'groups.id', 'group_messages.receiver_id')
                .where('group_messages.id', sendMessageId)
                .select('group_messages.receiver_id', 'groups.message_version')
                .first();
            if (row?.group_id) {
                const newVersion = Math.max(row.message_version || 0, versionId);
                await db('groups')
                    .where('id', row.group_id)
                    .update({ message_version: newVersion });
            }
        }

    } catch (error) {
        console.error('Failed to update message status:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sql: error.sql,
            bindings: error.bindings
        });
    }
});

ipcMain.handle('get-chat-history', async (event, { contactId, currentUserID, pageSize, isGroup, beforeTimestamp }) => {
    return await readChatHistory(contactId, currentUserID, pageSize, isGroup, beforeTimestamp);
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-server-url', () => {
    return SOCKET_SERVER_URL;
});


ipcMain.on('open-search-window', (event, { selectInformation }) => {
    createSearchWindow(currentUserId, selectInformation);
});

ipcMain.on('open-settings-window', () => {
    createSettingsWindow();
});

// --- User Credentials IPC Handlers ---
ipcMain.on('save-user-credentials-list', (event, credentials) => {
    userCredentialsManager.saveUserCredentials(credentials);
});

ipcMain.handle('get-user-credentials-list', () => {
    return userCredentialsManager.getUserCredentialsList();
});

ipcMain.on('save-current-user-credentials', (event, credentials) => {
    userCredentialsManager.saveCurrentCredentials(credentials);
});

ipcMain.handle('get-current-user-credentials', () => {
    return userCredentialsManager.getCurrentCredentials();
});

// 使用设置管理器
ipcMain.handle('get-app-settings', () => {
    return settingsManager.getAllSettings();
});

ipcMain.on('update-app-setting', (event, { key, value }) => {
    settingsManager.updateSetting(key, value);
});

ipcMain.on('switch-user', (event, switchUserID) => {
    userCredentialsManager.switchUser(switchUserID);
    app.relaunch();
    app.exit();
});

ipcMain.on('delete-saved-user', (event, removeUserID) => {
    userCredentialsManager.deleteUser(removeUserID);
});

ipcMain.on('updata-settings', (event, { key, value }) => {
    settingsManager.updateSetting(key, value);
});

ipcMain.handle('get-settings-value', (event, key) => {
    return settingsManager.getSetting(key);
});

ipcMain.on('update-language', (event, language) => {
    settingsManager.updateSetting('language', language);
    BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
            window.webContents.send('language-updated', language);
        }
    });
});

ipcMain.on('update-theme', (event, theme) => {
    settingsManager.updateSetting('theme', theme);
    BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
            window.webContents.send('theme-updated', theme);
        }
    });
})

// --- End User Credentials IPC Handlers ---

// --- Socket.IO IPC ---
// Listen for a renderer to send a message
ipcMain.on('socket-emit', (event, { event: eventName, args }) => {
    if (socket && socket.connected) {
        socket.emit(eventName, ...args);
    } else {
        console.error('Socket not connected, cannot emit event.');
        // Optionally, send an error back to the renderer
        event.sender.send('socket-error', 'Socket not connected');
    }
});

// --- 新的 MinIO 文件上传 IPC 处理 ---

// 1. 处理文件选择
ipcMain.handle('select-file', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) {
        return null;
    }
    return filePaths[0];
});

// 2. 处理文件上传流程
ipcMain.handle('initiate-file-upload', async (event, { filePath, senderId, receiverId, isGroup, messageId }) => {
    if (!filePath) {
        return { success: false, error: '文件路径不能为空' };
    }

    try {
        const fileName = path.basename(filePath);
        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size;

        // --- 步骤 1: 从服务器获取预签名 URL ---
        const initiateResponse = await apiClient.post(`api/upload/initiate`, {
            fileName,
            senderId,
            isGroup,
            receiverId
        });

        const { presignedUrl, objectName, fileId } = initiateResponse.data;

        if (!presignedUrl) {
            throw new Error('无法获取预签名上传URL');
        }

        // --- 步骤 2: 读取文件并直接上传到 MinIO ---
        const fileStream = fs.createReadStream(filePath);
        await axios.put(presignedUrl, fileStream, {
            headers: {
                'Content-Length': fileSize
            },
            // 可选：添加上传进度监控
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                event.sender.send('upload-progress', { messageId, percentCompleted });
            }
        });

        // --- 步骤 3: 通知服务器上传完成 ---
        const completeResponse = await apiClient.post(`api/upload/complete`, {
            fileName,
            objectName,
            fileId,
            fileSize,
            receiverId,
            senderId,
            messageId,
            isGroup
        });

        const returnedData = completeResponse.data.messageData;


        const saveMessage = {
            id: messageId,
            text: returnedData.content,
            sender: 'user',
            sender_id: returnedData.senderId,
            timestamp: new Date(),
            username: returnedData.username,
            fileName: returnedData.fileName,
            messageType: returnedData.messageType,
            type: returnedData.type,
            fileUrl: returnedData.fileUrl,
            fileSize: returnedData.fileSize,
            status: 'success',
            fileExt: true,
            localPath: filePath,
        }


        await writeChatHistory(receiverId, saveMessage)

        event.sender.send('file-upload-complete', { messageId });
        event.sender.send('sent-new-message', { contactId: receiverId, isGroup });

        return { success: true, messageData: returnedData, messageId };

    } catch (error) {
        console.error('文件上传失败:', error.response ? error.response.data : error.message);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('download-file', async (event, { messageId, fileUrl, fileName, isGroup }) => {
    try {
        if (!fileUrl) {
            throw new Error('文件URL为空');
        }

        // 构建完整 URL
        let fullUrl = fileUrl;
        if (!fileUrl.startsWith('http')) {
            fullUrl = `${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
        }

        // 下载路径
        const downloadsPath = app.getPath('downloads');
        const finalFileName = fileName || `file_${Date.now()}`;
        const filePath = path.join(downloadsPath, finalFileName);

        try {
            // 发起请求（Node Stream）
            const response = await apiClient.get(fullUrl, {
                responseType: 'stream',
                timeout: 0,
            });

            // 文件总大小（用于进度计算）
            const total = Number(response.headers['content-length']) || 0;
            let loaded = 0;

            // 通知开始下载
            event.sender.send('file-download-start', {
                messageId,
                fileName: finalFileName,
                total,
            });

            const writer = fs.createWriteStream(filePath);

            response.data.on('data', chunk => {
                loaded += chunk.length;

                if (total) {
                    const progress = Math.round((loaded / total) * 100);
                    event.sender.send('download-progress', {
                        messageId,
                        progress,
                        loaded,
                        total,
                    });
                }
            });

            // 错误处理
            response.data.on('error', err => {
                writer.destroy();
                throw err;
            });

            writer.on('error', err => {
                response.data.destroy();
                throw err;
            });

            // 管道写入
            response.data.pipe(writer);

            // 等待写入完成
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            event.sender.send('file-download-complete', { messageId });
        }
        catch (error) {
            if (error.response) {
                const status = error.response.status;

                // responseType: stream 时，错误体是一个 stream
                let errorMessage = '下载失败';

                try {
                    const chunks = [];
                    for await (const chunk of error.response.data) {
                        chunks.push(chunk);
                    }
                    const text = Buffer.concat(chunks).toString('utf-8');
                    const json = JSON.parse(text);
                    errorMessage = json.error || errorMessage;
                } catch {
                    // 忽略解析失败
                }

                return {
                    success: false,
                    error: errorMessage,
                    status,
                };
            }
        }

        // 打开文件位置
        shell.showItemInFolder(filePath);

        // 更新数据库
        try {
            if (db) {
                await db(isGroup ? 'group_messages' : 'messages')
                    .where('id', messageId)
                    .update({
                        fileExt: true,
                        localFilePath: filePath,
                    });
            }
        } catch (dbError) {
            console.error('数据库更新失败:', dbError);
        }

        return { success: true, filePath };
    } catch (error) {
        console.error('文件下载失败:', error);
        return { success: false, error: error.message };
    }
});


ipcMain.handle('open-file-location', async (event, { messageId, isGroup }) => {
    try {
        if (!messageId) {
            throw new Error('消息ID为空');
        }

        // 从数据库获取本地文件路径
        if (!db) {
            throw new Error('数据库未连接');
        }

        const message = await db(isGroup ? 'group_messages' : 'messages')
            .select('localFilePath', 'fileUrl')
            .where('id', messageId)
            .first();

        if (!message || !message.localFilePath) {
            return { success: false, error: '未找到本地文件路径' };
        }

        const filePath = message.localFilePath;

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            // 更新数据库中的文件存在状态
            try {
                await db(isGroup ? 'group_messages' : 'messages')
                    .where('id', messageId)
                    .update({ fileExt: false });
                console.log('Updated fileExt status to false for:', messageId);
            } catch (dbError) {
                console.error('Failed to update fileExt in database:', dbError);
            }
            return { success: false, error: '文件不存在或已被移动' };
        }

        // 打开文件资源管理器并选中文件
        shell.showItemInFolder(filePath);
        return { success: true };
    } catch (error) {
        console.error('Failed to open file location:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('resend-message', async (event, { messageId, isGroup }) => {
    try {
        if (!messageId) {
            return { success: false, error: '消息ID为空' };
        }
        if (!db) {
            return { success: false, error: '数据库未连接' };
        }
        let deleted
        if (isGroup) {
            deleted = await db('group_messages')
                .where('id', String(messageId))
                .del();
        }
        else {
            deleted = await db('messages')
                .where('id', String(messageId))
                .del();
        }
        return { success: deleted > 0, deleted };
    } catch (error) {
        console.error('Failed to delete message for resend:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('check-file-exists', async (event, { messageId, isGroup }) => {
    try {
        if (!messageId) {
            return { exists: false, error: '消息ID为空' };
        }

        // 从数据库获取本地文件路径
        if (!db) {
            return { exists: false, error: '数据库未连接' };
        }

        const message = await db(isGroup ? 'group_messages' : 'messages')
            .select('localFilePath')
            .where('id', messageId)
            .first();

        if (!message || !message.localFilePath) {
            try {
                await db(isGroup ? 'group_messages' : 'messages')
                    .where('id', messageId)
                    .update({ fileExt: false });
            } catch (dbError) {
                console.error('Failed to update fileExt in database:', dbError);
            }
            return { exists: false, error: '未找到本地文件路径' };
        }

        if (!fs.existsSync(message.localFilePath)) {
            try {
                await db(isGroup ? 'group_messages' : 'messages')
                    .where('id', messageId)
                    .update({ fileExt: false });
            } catch (dbError) {
                console.error('Failed to update fileExt in database:', dbError);
            }
            return { exists: false, error: '文件不存在或已被移动' };
        }

        return { exists: true };
    } catch (error) {
        console.error('Failed to check file exists:', error);
        return { exists: false, error: error.message };
    }
});

ipcMain.handle('check-assest-file-exits', async (event, filePath) => {
    return fs.existsSync(filePath);
})

async function downloadFileToLocal(fileUrl, filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        const response = await apiClient.get(fileUrl, {
            responseType: 'stream',
            timeout: 0,
        });
        const writer = fs.createWriteStream(filePath);

        response.data.on('data', chunk => {
            writer.write(chunk);
        });

        // 错误处理
        response.data.on('error', err => {
            writer.destroy();
            throw err;
        });

        writer.on('error', err => {
            response.data.destroy();
            throw err;
        });

        // 等待写入完成
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }
    catch (error) {
        console.error('文件下载失败:', error);
    }
}

ipcMain.handle('download-assest-file', async (event, { fileUrl, filePath }) => {
    await downloadFileToLocal(fileUrl, filePath);
})

ipcMain.handle('delete-contact', async (event, { contactId }) => {
    if (!db) {
        return { success: false, error: '数据库未连接' };
    }
    try {
        socket.emit('delete-contact', contactId);
    } catch (error) {
        console.error('Failed to delete contact:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-contact-message-history', async (event, { contact }) => {
    if (!db) {
        return { success: false, error: '数据库未连接' };
    }
    const contactId = contact.id;
    const isGroup = contact.type == 'group'

    if (isGroup) {
        const deleted = await db('group_messages')
            .where('receiver_id', contactId)
            .del();
        event.sender.send('message-history-deleted', { contactId, isGroup });
        return { success: true, deleted };
    }
    else {
        const deleted = await db('messages')
            .where('receiver_id', contactId)
            .orWhere('sender_id', contactId)
            .del();
        event.sender.send('message-history-deleted', { contactId, isGroup });
        return { success: true, deleted };
    }
});

ipcMain.on('save-invite-information-list', async (event, inviteInformation) => {
    if (!db) {
        return { success: false, error: '数据库未连接' };
    }
    try {
        if (inviteInformation.isGroup) {
            // 检查是否已存在该邀请
            const existingInvite = await db('invite_information')
                .where('id', inviteInformation.id)
                .first();

            // 如果不存在则插入新记录
            if (!existingInvite) {
                const timestamp = Date.now();
                await db('invite_information')
                    .insert({
                        id: inviteInformation.id,
                        group_id: inviteInformation.groupId,
                        group_name: inviteInformation.groupName,
                        inviter_id: inviteInformation.inviterId,
                        inviter_name: inviteInformation.inviterName,
                        is_group_invite: true,
                        create_time: timestamp,
                        update_time: timestamp
                    });
            }
            else {
                await db('invite_information')
                    .where('id', inviteInformation.id)
                    .update({
                        group_id: inviteInformation.groupId,
                        group_name: inviteInformation.groupName,
                        inviter_id: inviteInformation.inviterId,
                        inviter_name: inviteInformation.inviterName,
                        is_group_invite: true,
                        status: 'pending',
                        update_time: Date.now()
                    })
            }
            event.sender.send('receive-new-invite');
        } else {
            // 检查是否已存在该好友邀请
            const existingInvite = await db('invite_information')
                .where('id', inviteInformation.id)
                .first();

            // 如果不存在则插入新记录
            if (!existingInvite) {
                const timestamp = Date.now();
                await db('invite_information')
                    .insert({
                        id: inviteInformation.id,
                        inviter_id: inviteInformation.inviterId,
                        inviter_name: inviteInformation.inviterName,
                        is_group_invite: false,
                        create_time: timestamp,
                        update_time: timestamp,
                    });
            }
            else {
                await db('invite_information')
                    .where('id', inviteInformation.id)
                    .update({
                        inviter_id: inviteInformation.inviterId,
                        inviter_name: inviteInformation.inviterName,
                        is_group_invite: false,
                        update_time: Date.now(),
                        status: 'pending',
                    })
            }
            // 向渲染进程发送新邀请接收信号
            event.sender.send('receive-new-invite');
        }
    } catch (error) {
        console.error('保存邀请信息失败:', error);
        // 向渲染进程发送错误信息
        event.sender.send('invite-save-error', {
            error: error.message
        });
    }
});

ipcMain.on('accept-friend-request', async (event, requestId) => {
    if (!db) {
        return { success: false, error: '数据库未连接' };
    }
    try {
        const timestamp = Date.now();
        const updated = await db('invite_information')
            .where('id', requestId)
            .update({
                status: 'accept',
                update_time: timestamp
            });
        if (updated > 0) {
            const newFriend = await db('invite_information')
                .where('id', requestId)
                .select('inviter_id', 'inviter_name')
                .first();
            const newFriendData = {
                id: newFriend.inviter_id,
                userName: newFriend.inviter_name,
                addTime: timestamp,
            }
            await db('friends')
                .insert(newFriendData)
                .onConflict('id')
                .merge()
            const helloMessage = {
                id: `temp_${timestamp}`,
                sender_id: newFriend.inviter_id,
                receiver_id: currentUserId,
                text: '我们已经成为好友了，开始聊天吧！',
                sender: 'other',
                username: newFriend.inviter_name,
                messageType: 'text',
                timestamp: timestamp,
                status: 'success'
            }
            await db('messages')
                .insert(helloMessage)
            await db('invite_information')
            event.sender.send('friend-request-accepted', { requestId });
            event.sender.send('contacts-list-updated');
        }
    } catch (error) {
        console.error('接受好友请求失败:', error);
        // 向渲染进程发送错误信息
        event.sender.send('friend-request-accept-error', {
            error: error.message
        });
    }
});

ipcMain.on('decline-friend-request', async (event, requestId) => {
    if (!db) {
        return { success: false, error: '数据库未连接' };
    }
    await db('invite_information')
        .where('id', requestId)
        .update({
            status: 'decline',
            update_time: Date.now()
        });
});

ipcMain.on('decline-group-invite', async (event, requestId) => {
    if (!db) {
        return { success: false, error: '数据库未连接' };
    }
    await db('invite_information')
        .where('id', requestId)
        .update({
            status: 'decline',
            update_time: Date.now()
        });
    event.sender.send('group-invite-declined', { requestId });
});

ipcMain.on('accept-group-invite', async (event, requestId) => {
    if (!db) {
        return { success: false, error: '数据库未连接' };
    }
    try {
        const timestamp = Date.now();
        const updated = await db('invite_information')
            .where('id', requestId)
            .update({
                status: 'accept',
                update_time: timestamp
            });
        if (updated > 0) {
            const gruopInformation = await db('invite_information')
                .where('id', requestId)
                .select('group_id as groupId', 'group_name as groupName')
                .first();
            await db('groups')
                .insert({ id: gruopInformation.groupId, groupName: gruopInformation.groupName, addTime: timestamp })
                .onConflict('id')
                .merge()
            await db('invite_information')
                .where('group_id', gruopInformation.groupId)
                .update({
                    status: 'accept',
                    update_time: timestamp
                })
            event.sender.send('group-invite-accepted', { requestId });
            event.sender.send('contacts-list-updated');
        }
    } catch (error) {
        console.error('接受群组邀请失败:', error);
        // 向渲染进程发送错误信息
        event.sender.send('group-invite-accept-error', {
            error: error.message
        });
    }
});

// IPC handler to get current socket connection status
ipcMain.handle('get-socket-status', () => {
    return socket ? socket.connected : false;
});


ipcMain.handle('get-contact-list', async () => {
    if (!db) {
        return [];
    }
    let friends = await db('friends')
        .select('id', 'userName as username', 'lastMessage')
    friends = friends.map(item => ({
        ...item,
        type: 'friend'
    }));
    let groups = await db('groups')
        .select('id', 'groupName as username', 'lastMessage', 'my_role as myRole')
    groups = groups.map(item => ({
        ...item,
        type: 'group'
    }));
    const contactList = [...groups, ...friends].sort((a, b) => b.lastMessage - a.lastMessage);

    return contactList;
});

ipcMain.handle('get-last-message', async (event, { contactId, isGroup }) => {
    if (!db) {
        return null;
    }

    let lastMessage;
    if (isGroup) {
        lastMessage = await db('group_messages')
            .where('receiver_id', contactId)
            .orderBy('timestamp', 'desc')
            .first();
    } else {
        lastMessage = await db('messages')
            .where(function () {
                this.where('sender_id', contactId)
                    .orWhere('receiver_id', contactId);
            })
            .orderBy('timestamp', 'desc')
            .first();
    }
    return {
        username: lastMessage?.username,
        text: lastMessage?.text,
        timestamp: lastMessage?.timestamp
    };
})

ipcMain.handle('get-unread-message-count', async (event, { contactId, isGroup }) => {
    const unreadMEssageCount = unreadMessageManager.getUnreadMessageCount(currentUserId, contactId, isGroup);
    return unreadMEssageCount;
});

ipcMain.on('clear-unread-message-count', async (event, { contactId, isGroup }) => {
    unreadMessageManager.clearUnreadMessageCount(currentUserId, contactId, isGroup);
    event.sender.send('unread-message-count-cleared');
})

ipcMain.handle('get-all-unread-message-count', async () => {
    return unreadMessageManager.getAllUnreadMessageCount(currentUserId);

});

ipcMain.on('save-message-draft', async (event, { contactId, isGroup, draft }) => {
    userMessageDraftManager.saveUserMessageDraft(currentUserId, contactId, draft, isGroup)
})

ipcMain.handle('get-message-draft', async (event, { contactId, isGroup }) => {
    return userMessageDraftManager.getUserMessageDraft(currentUserId, contactId, isGroup)
})

ipcMain.on('clear-message-draft', async (event, { contactId, isGroup }) => {
    userMessageDraftManager.clearUserMessageDraft(currentUserId, contactId, isGroup)
})

ipcMain.on('update-user-contact-list-version', async (event, { userId, version }) => {
    userCredentialsManager.setUserContactListVersion(userId, version);
});

ipcMain.on('update-user-group-list-version', async (event, { userId, version }) => {
    userCredentialsManager.setUserGroupListVersion(userId, version);
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const data = fs.readFileSync(filePath);
        return data.toString('base64');
    } catch (error) {
        console.error('Failed to read file:', error);
        return null;
    }
});

ipcMain.handle('get-file-info', async (event, filePath) => {
    try {
        if (!filePath) {
            throw new Error('文件路径不能为空');
        }

        const stats = await fs.promises.stat(filePath);

        return {
            size: stats.size,
        };
    } catch (error) {
        console.error('Error getting file info:', error);
        throw error;
    }
});

ipcMain.handle('leave-group', async (event, { groupId, currentUserID }) => {
    try {
        if (!db) {
            return { success: false, error: '数据库未连接' };
        }

        socket.emit('leave-group', { groupId, userId: currentUserID });

        await db('group_messages')
            .where('receiver_id', groupId)
            .del();
        await db('groups')
            .where('id', groupId)
            .del();
    } catch (error) {
        console.error('Failed to leave group:', error);
    }
});

ipcMain.handle('get-invite-information-list', async () => {
    if (!db) {
        return [];
    }
    const inviteInformationList = await db('invite_information')
        .select('*')
    return inviteInformationList;
});

ipcMain.handle('get-group-member', async (event, groupId) => {
    if (!db) {
        return [];
    }
    const groupMemberList = await db('group_member')
        .where('group_id', groupId)
        .select('*')

    return groupMemberList
});

ipcMain.handle('get-group-member-version', async (event, groupId) => {
    const version = await db('groups')
        .where('id', groupId)
        .select('member_version')
        .first();
    return version.member_version || 0;
});

ipcMain.on('save-group-member', async (event, { groupId, version, groupMembers }) => {
    groupMembers.forEach(async (groupMember) => {
        await db('group_member')
            .insert({
                group_id: groupId,
                member_id: groupMember.user_id,
                member_name: groupMember.user_name,
                role: groupMember.role,
                join_time: groupMember.join_time
            })
            .onConflict(['group_id', 'member_id'])
            .merge(
                { role: groupMember.role, join_time: groupMember.join_time }
            )
    });

    await db('groups')
        .where('id', groupId)
        .update({ member_version: version })
    BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('group-member-updated', { groupId });
    })
})

ipcMain.on('update-group-member-version', async (event, { groupId, version, groupMembers }) => {
    groupMembers.forEach(async (groupMember) => {
        const { user_id, action, event_data } = groupMember
        if (action === 'group_member_add') {
            const { role, username, join_time } = event_data
            console.log('新用户加入群聊', groupId, user_id, username, role, join_time)
            await db('group_member')
                .insert({
                    group_id: groupId,
                    member_id: user_id,
                    member_name: username,
                    role,
                    join_time
                })
                .onConflict(['group_id', 'member_id'])
                .ignore()
        }
        if (action === 'left') {
            await db('group_member')
                .where('group_id', groupId)
                .andWhere('member_id', user_id)
                .del()
        }
        if (action === 'update') {
            return
        }
    })
    await db('groups')
        .where('id', groupId)
        .update({ member_version: version })
    BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('group-member-updated', { groupId });
    })
})

ipcMain.handle('update-group-name', async (event, { groupId, newGroupName }) => {
    if (socket) {
        try {
            const response = await new Promise((resolve, reject) => {
                socket.timeout(5000).emit('update-group-name', { groupId, newGroupName }, (err, res) => {
                    if (err) {
                        reject(err);
                        return
                    } else {
                        resolve(res);
                    }
                })
            })

            if (!response.success) {
                return {
                    success: false,
                    error: response.error
                }
            }
            return {
                success: true,
                data: response
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    }
    else {
        return {
            success: false,
            error: '未连接服务器'
        }
    }
})

ipcMain.handle('search-local-history', async (event, searchMessage) => {
    const result = {}
    const friends = await db('friends')
        .select('id', 'userName as username')
        .where('userName', 'like', `%${searchMessage}%`)
        .orWhere('id', 'like', `%${searchMessage}%`)
    const groups = await db('groups')
        .select('id', 'groupName as username')
        .where('groupName', 'like', `%${searchMessage}%`)
        .orWhere('id', 'like', `%${searchMessage}%`)
    const messages = await db('messages')
        .select('id', 'text', 'sender_id', 'receiver_id', 'timestamp')
        .where('text', 'like', `%${searchMessage}%`)
    const rawGroupMembers = await db('group_member')
        .select('group_id', 'member_id', 'member_name')
        .where('member_name', 'like', `%${searchMessage}%`)
        .orWhere('member_id', 'like', `%${searchMessage}%`)

    const seen = new Set();
    const groupMembers = rawGroupMembers.filter(member => {
        if (seen.has(member.member_id)) {
            return false;
        }
        seen.add(member.member_id);
        return true;
    });

    result.friends = friends;
    result.groups = groups;
    result.messages = messages;
    result.groupMembers = groupMembers;
    return result;
})

ipcMain.on('user-login', (event, credentials) => {
    socket.emit('login-user', credentials);
});



const loginId = uuidv4();
const loginMap = new Map();


const CLINEID = config.CLINEID;

ipcMain.handle('github-oauth', async () => {
    const clientId = CLINEID;
    const redirectUri = encodeURIComponent(
        `${SOCKET_SERVER_URL}/api/auth/github/callback`
    );

    const authUrl =
        `https://github.com/login/oauth/authorize` +
        `?client_id=${clientId}` +
        `&redirect_uri=${redirectUri}` +
        `&scope=user:email` +
        `&state=${loginId}`;

    shell.openExternal(authUrl);
});

ipcMain.on('strong-logout-waring', async (event, message) => {

    // 销毁托盘图标
    if (tray) {
        tray.destroy();
        tray = null;
    }

    // 断开当前连接
    if (socket) {
        socket.disconnect();
    }

    event.sender.send('strong-logout-waring', message);
});

ipcMain.on('logout', async () => {
    app.relaunch();
    app.exit();
});

const creatVoiceWindow = async (event, { contactId, callMode, callerId, roomId, offer }) => {
    voiceWindow = new BrowserWindow({
        width: 400,
        height: 600,
        minHeight: 300,
        minWidth: 400,
        frame: false,
        webPreferences: {
            preload: path.join(app.getAppPath(), "src", "electron", "preload.js"),
            devTools: isDev
        }
    });

    offer = JSON.stringify(offer);
    // 对 stringify 后的 JSON 字符串进行 URL 编码，防止特殊字符破坏 URL 结构
    const encodedOffer = encodeURIComponent(offer);

    let voiceWindowPath;
    if (isDev) {
        voiceWindowPath = `http://localhost:5234/voice.html?contactId=${contactId}&userId=${currentUserId}&callMode=${callMode}&callerId=${callerId}&roomId=${roomId}&offer=${encodedOffer}`;
    }
    else {
        voiceWindowPath = `file://${path.join(app.getAppPath(), "dist", "voice.html")}?contactId=${contactId}&userId=${currentUserId}&callMode=${callMode}&callerId=${callerId}&roomId=${roomId}&offer=${encodedOffer}`;
    }
    if (isDev) {
        voiceWindow.openDevTools()
    }
    voiceWindow.loadURL(voiceWindowPath);
    voiceWindow.on('closed', () => {
        voiceWindow = null;
    });
}

//音视频通话功能模块
ipcMain.on('voice-call-to-contact', async (event, { contactId = null, callMode = null, callerId = null, roomId = null, offer = null }) => {
    if (!voiceWindow) {
        await creatVoiceWindow(event, { contactId, callMode, callerId, roomId, offer });
    }
    else {
        return
    }
});

ipcMain.on('write-log', (event, logEntry) => {
    const logFilePath = path.join(app.getPath('userData'), 'app.log');
    const logMessage = `[${new Date().toISOString()}] ${logEntry}\n`;
    if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, '');
    }
    fs.writeFileSync(logFilePath, logMessage, { flag: 'a' });
})

ipcMain.handle('get-voice-chat-server-url', async () => {
    return { turnsVoiceServerUrl: config.TURNS_VOICE_SERVER_URL, voiceServerUrl: config.SOCKET_VOICE_SERVER_URL, username: config.VOICE_SERVER_USERNAME, credential: config.VOICE_SERVER_CREDENTIAL }
})

// --- End Socket.IO IPC ---

// --- IPC handler to reset migration version ---
ipcMain.on('reset-migration-version', async (event, { userId, version }) => {
    try {
        dbMigrationManager.setMigrationVersion(userId, version);
        console.log(`Migration version for user ${userId} set to ${version}`);
        event.sender.send('migration-version-reset-success', { userId, version });
    } catch (error) {
        console.error(`Failed to reset migration version for user ${userId}:`, error);
        event.sender.send('migration-version-reset-error', { userId, error: error.message });
    }
});
// --- End IPC handler to reset migration version ---


function handleProtocol(argv) {
    const url = argv.find(arg => arg.startsWith('fastshow://'));

    // 关键：聚焦旧窗口
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
    if (!url) return;

    const parsed = new URL(url);
    const loginId = parsed.searchParams.get('loginId');
    const token = parsed.searchParams.get('token');

    if (!loginId || !token) return;

    const info = loginMap.get(loginId);
    if (!info) {
        console.warn('loginId not found:', loginId);
        return;
    }

    const win = BrowserWindow.fromId(info.windowId);
    if (!win) return;

    win.webContents.send('oauth-success', { token });
    loginMap.delete(loginId);
}

app.on('second-instance', (event, argv) => {
    handleProtocol(argv);
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        if (socket) socket.disconnect();
        app.quit()
    }
})


const PROTOCOL = 'fastshow';


app.setAsDefaultProtocolClient(PROTOCOL);