import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { io } from 'socket.io-client';
import Store from 'electron-store';
import knex from 'knex';
import fs from 'fs';
import fetch from 'node-fetch';
import axios from 'axios';
import { console } from 'inspector/promises';
import { initializeDatabase, migrateUserDb } from './dbOptions.js';
import { Tray, Menu } from 'electron';


// ESM-compliant __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development"
const store = new Store();

// --- Socket.IO Main Process Setup ---
const configPath = path.join(__dirname, '..', '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const SOCKET_SERVER_URL = config.DEV_SERVER_URL;
let socket;
let heartbeatInterval;
let reconnectionTimer;
let heartbeatTimeout;
let tray = null;



function connectSocket() {

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

    // Add a listener for connection errors
    socket.on('connect_error', (err) => {
        console.error('Socket connection error in main process:', err.message);
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('socket-event', { event: 'connect_error', args: [err.message] });
        });
        if (!reconnectionTimer) {
            reconnectionTimer = setTimeout(connectSocket, 5000);
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('socket-event', { event: 'reconnecting' });
            });
        }
    });

    socket.on('connect', () => {
        console.log('Socket connected to server in main process:', socket.id);
        if (reconnectionTimer) {
            clearTimeout(reconnectionTimer);
            reconnectionTimer = null;
        }
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('socket-event', { event: 'connect', id: socket.id });
        });

        // Auto re-authenticate using saved token after reconnect
        const creds = store.get('currentUserCredentials');
        if (creds && creds.token) {
            socket.emit('login-with-token', creds.token);
        }

        // Start heartbeat
        heartbeatInterval = setInterval(() => {
            heartbeatTimeout = setTimeout(() => {
                if (socket) {
                    socket.disconnect();
                }
            }, 2000); // Assume timeout if no pong in 2 seconds
            socket.emit('heartbeat', 'ping');
        }, 5000); // Send ping every 5 seconds
    });

    socket.on('heartbeat', (payload) => {
        if (payload === 'pong') {
            clearTimeout(heartbeatTimeout); // Pong received, clear timeout
        }
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected from server in main process');
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
    });

    // Generic listener to forward all server events to renderer processes
    socket.onAny((event, ...args) => {
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('socket-event', { event, args });
        });
    });
}
// --- End Socket.IO Setup ---

let dbPath;
let db;




// 读取指定联系人的聊天记录
async function readChatHistory(contactId, currentUserID, page = 1, pageSize = 20, isGroup) {
    try {
        // 获取私聊消息
        if (!isGroup) {
            // 确保数据库已初始化
            const exists = await db.schema.hasTable('messages');
            if (!exists) {
                await initializeDatabase(db);
                // 重新检查表是否存在
                const existsAfterInit = await db.schema.hasTable('messages');
                if (!existsAfterInit) {
                    console.error('Failed to create messages table');
                    return [];
                }
            }

            const offset = (page - 1) * pageSize;

            const history = await db('messages')
                .select('*')
                .where(function () {
                    this.where('sender_id', String(currentUserID)).andWhere('receiver_id', String(contactId));
                })
                .orWhere(function () {
                    this.where('sender_id', String(contactId)).andWhere('receiver_id', String(currentUserID));
                })
                .orderBy('timestamp', 'desc')
                .limit(pageSize)
                .offset(offset);

            return history.reverse(); // 保证消息按时间升序排列
        }
        else {
            const exists = await db.schema.hasTable('group_messages');
            if (!exists) {
                await initializeDatabase(db);
                // 重新检查表是否存在
                const existsAfterInit = await db.schema.hasTable('group_messages');
                if (!existsAfterInit) {
                    console.error('Failed to create messages table');
                    return [];
                }
            }

            const offset = (page - 1) * pageSize;

            const history = await db('group_messages')
                .select('*')
                .where(function () {
                    this.where('receiver_id', String(contactId));
                })
                .orderBy('timestamp', 'desc')
                .limit(pageSize)
                .offset(offset);

            return history.reverse(); // 保证消息按时间升序排列
        }
    } catch (error) {
        console.error(`Failed to read chat history for contact ${contactId}:`, error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sql: error.sql,
            bindings: error.bindings
        });
        return [];
    }
}

// 写入指定联系人的聊天记录
async function writeChatHistory(contactId, currentUserID, msg) {
    try {
        // 确保数据库已初始化
        const exists = await db.schema.hasTable('messages') && await db.schema.hasTable('group_messages');
        if (!exists) {
            await initializeDatabase(db);
        }

        // 确保所有必需字段都存在并转换为正确的类型
        const messageData = {
            id: msg.id,
            sender_id: msg.sender == 'user' ? currentUserID : msg.sender_id,
            receiver_id: contactId,
            text: msg.text || '',
            username: msg.username || '',
            timestamp: msg.timestamp || new Date().toISOString(),
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
            await db('messages').insert(messageData);
        }
        else{
            await db('group_messages').insert(messageData);
        }
    } catch (error) {
        console.error(`Failed to write chat history for contact ${contactId}:`, error);
        console.error('Error details:', {
            message: error.message,
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
    settingsWindow = new BrowserWindow({
        width: 500,
        height: 400,
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
    searchWindow = new BrowserWindow({
        width: 500,
        height: 400,
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
    // 避免重复创建托盘
    if (tray) {
        return;
    }
    // 使用 PNG/ICO 作为托盘图标（Windows 不支持 SVG）
    const iconPath = path.join(app.getAppPath(), 'src', 'ui', 'assets', 'title.png');
    tray = new Tray(iconPath);

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
    const mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        frame: false,
        webPreferences: {
            preload: path.join(app.getAppPath(), "src", "electron", "preload.js"),
            devTools: isDev
        }
    });

    if (isDev) {
        mainWindow.loadURL("http://localhost:5234");
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
    }
    mainWindow.setMenu(null);

    // 创建托盘
    createTray(mainWindow);


    // 显示时恢复任务栏图标
    mainWindow.on('show', () => {
        mainWindow.setSkipTaskbar(false);
    });

    // 处理窗口关闭事件（点击关闭按钮隐藏到托盘）
    mainWindow.on('close', (event) => {
        if (!app.quitting) {
            event.preventDefault();
            mainWindow.setSkipTaskbar(true);
            mainWindow.hide();
        }
    });
}

// 在应用退出前清理
app.on('before-quit', () => {
    app.quitting = true;
});

function createErrorWindow(error) {
    const errorWindow = new BrowserWindow({
        width: 500,
        height: 200,
        webPreferences: {
            preload: path.join(app.getAppPath(), "src", "electron", "preload.js"),
            devTools: isDev
        }
    });
    const searchUrl = isDev
        ? `http://localhost:5234/errorMessage.html`
        : `file://${path.join(app.getAppPath(), "dist", "errorMessage.html")}`;

    errorWindow.loadURL(searchUrl).catch(err => console.error('Failed to load error URL:', err));
    errorWindow.webContents.on('did-finish-load', () => {
        errorWindow.webContents.send('error-message', error);
    });
    errorWindow.setMenu(null);
}

let groupWindow = null
function createGroupWindow(currentID) {
    if (groupWindow) {
        groupWindow.focus();
        return;
    }
    groupWindow = new BrowserWindow({
        width: 600,
        height: 500,
        frame: false,
        webPreferences: {
            preload: path.join(app.getAppPath(), "src", "electron", "preload.js"),
            devTools: isDev
        }
    });
    const createGroupUrl = isDev
        ? `http://localhost:5234/createGroup.html?currentID=${currentID}`
        : `file://${path.join(app.getAppPath(), "dist", "createGroup.html")}?currentID=${currentID}`;

    groupWindow.loadURL(createGroupUrl).catch(err => console.error('Failed to load createGroup URL:', err));

    if (isDev) {
        groupWindow.webContents.openDevTools();
    }

    groupWindow.setMenu(null);
    groupWindow.on('closed', () => {
        groupWindow = null;
    });
}

app.whenReady().then(async () => {
    // --- Socket.IO Connection ---
    connectSocket();
    // --- End Socket.IO Connection ---

    createMainWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
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
    if (window) {
        window.close();
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

ipcMain.on('login-success', async (event, userID) => {
    try {
        const userDbPath = path.join(app.getPath('userData'), `${userID}`);

        if (!fs.existsSync(userDbPath)) {
            fs.mkdirSync(userDbPath, { recursive: true });
        }

        dbPath = path.join(userDbPath, 'chat_history.sqlite3');

        // 创建数据库连接
        db = knex({
            client: 'sqlite3',
            connection: {
                filename: dbPath,
            },
            useNullAsDefault: true
        });

        // 初始化数据库（确保表存在）
        await initializeDatabase(db);
        try {
            await migrateUserDb(db, userID, dbPath, store);
        } catch (e) {
            console.error('User DB migration failed:', e);
        }

        if (await db.schema.hasTable('friends')) {
            socket.on('friends-list', async (payload) => {
                try {
                    const list = Array.isArray(payload) ? payload : Object.values(payload || {});
                    const rows = list.map(f => ({
                        id: String(f.id),
                        userName: String(f.username || f.userName || ''),
                        addTime: f.created_at ? new Date(f.created_at) : new Date(),
                        nickName: f.nickName ? String(f.nickName) : null
                    })).filter(r => r.id && r.userName);

                    if (rows.length > 0) {
                        await db('friends')
                            .insert(rows)
                            .onConflict('id')
                            .ignore();
                    }
                }
                catch (e) {
                    console.error('Friends seeding error:', e);
                }
            });
        }
        socket.emit('get-friends-grounds-list');
    }



    catch (error) {
        console.error('Error in login-success handler:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sql: error.sql,
            bindings: error.bindings
        });
    }
})


ipcMain.on('chat-message', (event, { contactId, currentUserID, msg }) => {
    // Safety check to prevent writing undefined data
    if (!msg) {
        console.error('Received chat-message with undefined msg object.');
        return;
    }
    writeChatHistory(contactId, currentUserID, msg);
});

ipcMain.on('message-sent-status', async (event, { senderInfo, sendMessageId, receiverId, status, isGroup }) => {
    try {

        const userDbPath = path.join(app.getPath('userData'), String(senderInfo?.userId || senderInfo));

        const senderDb = knex({
            client: 'sqlite3',
            connection: {
                filename: path.join(userDbPath, 'chat_history.sqlite3'),
            },
            useNullAsDefault: true
        });

        if (!senderDb) {
            console.error('Database not connected, cannot update message status.');
            return;
        }
        //改变私聊信息状态
        if (!isGroup) {
            await senderDb('messages')
                .where('id', String(sendMessageId))
                .andWhere('receiver_id', String(receiverId))
                .update({ status: status });
        }
        //改变群聊信息状态
        else {
            await senderDb('groups_messages')
                .where('id', String(sendMessageId))
                .andWhere('receiver_id', String(receiverId))
                .update({ status: status });
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

ipcMain.handle('get-chat-history', async (event, { contactId, currentUserID, page, pageSize, isGroup }) => {
    return await readChatHistory(contactId, currentUserID, page, pageSize, isGroup);
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.on('open-search-window', (event, { userId, selectInformation }) => {
    createSearchWindow(userId, selectInformation);
});

ipcMain.on('open-settings-window', () => {
    createSettingsWindow();
});

ipcMain.on('show-error-window', (event, error) => {
    createErrorWindow(error);
});

ipcMain.on('open-create-group-window', (event, { userId }) => {
    createGroupWindow(userId);
});

// --- User Credentials IPC Handlers ---
ipcMain.on('save-user-credentials-list', (event, credentials) => {
    let originalUserList = store.get('userCredentials') || {};
    originalUserList[credentials.userId] = {
        userId: credentials.userId,
        userName: credentials.userName,
        token: credentials.token
    };
    store.set('userCredentials', originalUserList);
});

ipcMain.handle('get-user-credentials-list', () => {
    return store.get('userCredentials');
});

ipcMain.on('save-current-user-credentials', (event, credentials) => {
    store.set('currentUserCredentials', {
        userId: credentials.userId,
        userName: credentials.userName,
        token: credentials.token
    });
});

ipcMain.handle('get-current-user-credentials', () => {
    return store.get('currentUserCredentials');
});

ipcMain.on('switch-user', (event, switchUserID) => {
    const userList = store.get('userCredentials') || {};
    store.set('currentUserCredentials', userList[switchUserID]);
    app.relaunch();
    app.exit();
});

ipcMain.on('delete-saved-user', (event, removeUserID) => {
    let userList = store.get('userCredentials') || {};
    delete userList[removeUserID];
    store.set('userCredentials', userList);
});

ipcMain.on('logout', () => {
    store.delete('currentUserCredentials');
    app.relaunch();
    app.exit();
});
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
ipcMain.handle('initiate-file-upload', async (event, { filePath, senderId, receiverId }) => {
    if (!filePath) {
        return { success: false, error: '文件路径不能为空' };
    }

    try {
        const fileName = path.basename(filePath);
        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size;

        // --- 步骤 1: 从服务器获取预签名 URL ---
        const initiateResponse = await axios.post(`${SOCKET_SERVER_URL}/api/upload/initiate`, {
            fileName,
            senderId
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
                // 你可以在这里通过 event.sender.send 将进度发送回渲染进程
                // event.sender.send('upload-progress', { fileId, percentCompleted });
                console.log(`上传进度: ${percentCompleted}%`);
            }
        });

        // --- 步骤 3: 通知服务器上传完成 ---
        const completeResponse = await axios.post(`${SOCKET_SERVER_URL}/api/upload/complete`, {
            fileName,
            objectName,
            fileId,
            fileSize,
            receiverId,
            senderId
        });

        return { success: true, messageData: completeResponse.data.messageData };

    } catch (error) {
        console.error('文件上传失败:', error.response ? error.response.data : error.message);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('download-file', async (event, { fileUrl, fileName }) => {
    try {
        if (!fileUrl) {
            throw new Error('文件URL为空');
        }

        // 如果是相对路径，构建完整URL
        let fullUrl = fileUrl;
        if (!fileUrl.startsWith('http')) {
            fullUrl = `${SOCKET_SERVER_URL}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
        }

        // 获取下载文件夹路径
        const downloadsPath = app.getPath('downloads');
        const fullFileName = fileName || `file_${Date.now()}`;
        const filePath = path.join(downloadsPath, fullFileName);

        // 从服务器下载文件
        const response = await fetch(fullUrl);
        if (!response.ok) {
            const errorInfo = await response.json();
            return { success: false, error: errorInfo.error };
        }

        // 将文件内容写入本地
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        // 打开文件资源管理器并选中文件
        shell.showItemInFolder(filePath);

        // 更新数据库中的文件存在状态和本地文件路径
        try {
            if (db) {
                // 根据fileUrl查找并更新fileExt状态和localFilePath
                await db('messages')
                    .where('fileUrl', fileUrl)
                    .update({
                        fileExt: true,
                        localFilePath: filePath
                    });
                console.log('Updated fileExt status to true and localFilePath for:', fileUrl);
            }
        } catch (dbError) {
            console.error('Failed to update fileExt and localFilePath in database:', dbError);
        }

        return { success: true, filePath, action: 'downloaded' };
    } catch (error) {
        console.error('Failed to download file:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('open-file-location', async (event, { messageId }) => {
    try {
        if (!messageId) {
            throw new Error('消息ID为空');
        }

        // 从数据库获取本地文件路径
        if (!db) {
            throw new Error('数据库未连接');
        }

        const message = await db('messages')
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
                await db('messages')
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
            deleted = await db('messages')
                .where('id', String(messageId))
                .del();
        }
        else {
            deleted = await db('group_messages')
                .where('id', String(messageId))
                .del();
        }
        return { success: deleted > 0, deleted };
    } catch (error) {
        console.error('Failed to delete message for resend:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('check-file-exists', async (event, { messageId }) => {
    try {
        if (!messageId) {
            return { exists: false, error: '消息ID为空' };
        }

        // 从数据库获取本地文件路径
        if (!db) {
            return { exists: false, error: '数据库未连接' };
        }

        const message = await db('messages')
            .select('localFilePath')
            .where('id', messageId)
            .first();

        if (!message || !message.localFilePath) {
            try {
                await db('messages')
                    .where('id', messageId)
                    .update({ fileExt: false });
            } catch (dbError) {
                console.error('Failed to update fileExt in database:', dbError);
            }
            return { exists: false, error: '未找到本地文件路径' };
        }

        if (!fs.existsSync(message.localFilePath)) {
            try {
                await db('messages')
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

// IPC handler to get current socket connection status
ipcMain.handle('get-socket-status', () => {
    return socket ? socket.connected : false;
});


ipcMain.handle('get-friends-list', async () => {
    if (!db) {
        return [];
    }
    const friends = await db('friends')
        .select('id', 'userName', 'nickName', 'addTime', 'type')
    return friends;
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
// --- End Socket.IO IPC ---

// --- IPC handler to reset migration version ---
ipcMain.on('reset-migration-version', async (event, { userId, version }) => {
    const migrationKey = `dbMigrationVersion:${userId}`;
    try {
        store.set(migrationKey, version);
        console.log(`Migration version for user ${userId} set to ${version}`);
        event.sender.send('migration-version-reset-success', { userId, version });
    } catch (error) {
        console.error(`Failed to reset migration version for user ${userId}:`, error);
        event.sender.send('migration-version-reset-error', { userId, error: error.message });
    }
});
// --- End IPC handler to reset migration version ---

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})
