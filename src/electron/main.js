import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import autoUpdater from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'url';
import { io } from 'socket.io-client';
import Store from 'electron-store';
import knex from 'knex';
import fs from 'fs';
import fetch from 'node-fetch';
import apiClient from './api.js';
import axios from 'axios';
import { initializeDatabase, migrateUserDb } from './dbOptions.js';
import { Tray, Menu } from 'electron';
import { snowflake } from './snowFlake.js';


// ESM-compliant __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development"
const store = new Store();

// --- Socket.IO Main Process Setup ---
const configPath = path.join(__dirname, '..', '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const SOCKET_SERVER_URL = (isDev ? config.DEV_SERVER_URL : config.SOCKET_SERVER_URL) || 'http://localhost:3001';
let socket;
let heartbeatInterval;
let reconnectionTimer;
let heartbeatTimeout;
let tray = null;
let mainWindow = null;
let currentUserId;
let currentUserToken;



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
async function readChatHistory(
    contactId,
    currentUserID,
    pageSize = 20,
    isGroup,
    beforeTimestamp = null
) {
    try {
        const tableName = isGroup ? 'group_messages' : 'messages';

        const exists = await db.schema.hasTable(tableName);
        if (!exists) {
            await initializeDatabase(db);
            if (!(await db.schema.hasTable(tableName))) {
                console.error(`Failed to create ${tableName} table`);
                return [];
            }
        }

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

        return history.reverse();
    } catch (error) {
        console.error(`Failed to read chat history for contact ${contactId}:`, error);
        return [];
    }
}

// 写入指定联系人的聊天记录
async function writeChatHistory(contactId, msg) {
    try {
        // 确保数据库已初始化
        const exists = await db.schema.hasTable('messages') && await db.schema.hasTable('group_messages');
        if (!exists) {
            await initializeDatabase(db);
        }

        // 确保所有必需字段都存在并转换为正确的类型
        const messageData = {
            id: msg.id,
            sender_id: msg.sender == 'user' ? currentUserId : msg.sender_id,
            receiver_id: msg.sender == 'user' ? contactId : (msg.type == 'private' ? currentUserId : contactId),
            text: msg.text || '',
            username: msg.username || '',
            timestamp: msg.timestamp || new Date(),
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
        else {
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
        mainWindow.loadURL("http://localhost:5234");
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
    const parentWindow = BrowserWindow.getFocusedWindow() || mainWindow;
    const parentBounds = parentWindow.getBounds();
    const width = 500;
    const height = 200;

    const x = Math.round(parentBounds.x + (parentBounds.width - width) / 2);
    const y = Math.round(parentBounds.y + (parentBounds.height - height) / 2);

    const errorWindow = new BrowserWindow({
        width: width,
        height: height,
        x,
        y,
        parent: parentWindow,
        modal: true,
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

app.whenReady().then(async () => {
    // --- Socket.IO Connection ---
    connectSocket();
    // --- End Socket.IO Connection ---

    createMainWindow()
    autoUpdater.checkForUpdatesAndNotify();

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
    if (window && !app.quitting) {
        if (window === mainWindow && !tray) {
            app.quit();
        } else {
            window.close();
        }
    }
    else {
        app.quit();
    }
});

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

ipcMain.on('login-success', async (event,{ userId, token }) => {
    currentUserId = userId;
    currentUserToken = token;
    try {
        const userDbPath = path.join(app.getPath('userData'), `${userId}`);

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
            await migrateUserDb(db, userId, dbPath, store);
        } catch (e) {
            console.error('User DB migration failed:', e);
        }

        const handleContactsList = async (payload) => {
            try {
                const contacts = Array.isArray(payload) ? payload : Object.values(payload || {});

                let remoteFriend = new Array()
                let remoteGroups = new Array()

                for (const contact of contacts) {
                    if (contact.type == 'friend') remoteFriend.push(contact);
                    else remoteGroups.push(contact);
                }

                const remoteFriendIds = new Set(remoteFriend.map(f => String(f.id)));
                const remoteGroupIds = new Set(remoteGroups.map(g => String(g.id)));

                const localFriends = await db('friends').select('id');
                const localFriendIds = new Set(localFriends.map(f => String(f.id)));

                const localGroups = await db('groups').select('id');
                const localGroupIds = new Set(localGroups.map(g => String(g.id)));

                const groupsToAdd = remoteGroups.filter(g => !localGroupIds.has(String(g.id)))
                const friendsToAdd = remoteFriend.filter(f => !localFriendIds.has(String(f.id)));

                if (friendsToAdd.length > 0) {
                    const rows = friendsToAdd.map(f => ({
                        id: String(f.id),
                        userName: String(f.username || f.userName || ''),
                        addTime: f.created_at ? new Date(f.created_at) : new Date(),
                        nickName: f.nickName ? String(f.nickName) : null
                    }));
                    await db('friends').insert(rows).onConflict('id').ignore();
                }

                if (groupsToAdd.length > 0) {
                    const rows = groupsToAdd.map(g => ({
                        id: String(g.id),
                        groupName: String(g.username),
                        addTime: g.created_at ? new Date(g.joinedAt) : new Date(),
                    }));
                    await db('groups').insert(rows).onConflict('id').ignore();
                }

                const friendsToDelete = [...localFriendIds].filter(id => !remoteFriendIds.has(id));
                const groupsToDelete = [...localGroupIds].filter(id => !remoteGroupIds.has(id));

                if (groupsToDelete.length > 0) {
                    await db('groups').whereIn('id', groupsToDelete).update({ isMember: false });
                }
                if (friendsToDelete.length > 0) {
                    await db('friends').whereIn('id', friendsToDelete).update({ isFriend: false });
                }

            } catch (e) {
                console.error('Friends sync error:', e);
            }
        }


        if (await db.schema.hasTable('friends')) {
            if (socket && handleContactsList) {
                socket.off('contacts-list', handleContactsList);
            }
            socket.on('contacts-list', handleContactsList);
        }
        // 创建托盘 - 同样需要更新托盘图标路径
        createTray(mainWindow);
        socket.emit('initial-data-success', { userId: userId });
        socket.emit('get-contacts');
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


ipcMain.on('new-chat-message', (event, { contactId, msg }) => {
    // Safety check to prevent writing undefined data
    if (!msg) {
        console.error('Received chat-message with undefined msg object.');
        return;
    }

    writeChatHistory(contactId, msg);
    event.sender.send('receive-new-message', contactId);
});

ipcMain.handle('send-private-message', async (event, { receiverId, message }) => {
    const messageId = snowflake.nextId().toString();


    const fullMessage = {
        ...message,
        id: messageId,
        receiver_id: receiverId,
        timestamp: Date.now(),
        sender: 'user',
    };

    await writeChatHistory(receiverId, fullMessage);
    socket.emit('send-private-message', fullMessage);

    return messageId;
});

ipcMain.handle('send-group-message', async (event, { groupId, message }) => {
    const messageId = snowflake.nextId().toString();
    const fullMessage = {
        ...message,
        id: messageId,
        receiver_id: groupId,
        timestamp: Date.now(),
        sender: 'user',
    };
    await writeChatHistory(groupId, fullMessage);
    socket.emit('send-group-message', fullMessage);

    return messageId;
});


ipcMain.on('message-sent-status', async (event, { senderInfo, sendMessageId, isGroup }) => {
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
                .where('id', sendMessageId)
                .update({ status: 'success' });
        }
        //改变群聊信息状态
        else {
            await senderDb('group_messages')
                .where('id', sendMessageId)
                .update({ status: 'success' });
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

ipcMain.on('open-search-window', (event, { userId, selectInformation }) => {
    createSearchWindow(userId, selectInformation);
});

ipcMain.on('open-settings-window', () => {
    createSettingsWindow();
});

ipcMain.on('show-error-window', (event, error) => {
    createErrorWindow(error);
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
ipcMain.handle('initiate-file-upload', async (event, { filePath, senderId, receiverId, isGroup }) => {
    if (!filePath) {
        return { success: false, error: '文件路径不能为空' };
    }

    try {
        const fileName = path.basename(filePath);
        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size;

        // --- 步骤 1: 从服务器获取预签名 URL ---
        const initiateResponse = await apiClient.post(`${SOCKET_SERVER_URL}/api/upload/initiate`, {
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
                // 你可以在这里通过 event.sender.send 将进度发送回渲染进程
                // event.sender.send('upload-progress', { fileId, percentCompleted });
                console.log(`上传进度: ${percentCompleted}%`);
            }
        });

        const messageId = snowflake.nextId().toString();

        // --- 步骤 3: 通知服务器上传完成 ---
        const completeResponse = await apiClient.post(`${SOCKET_SERVER_URL}/api/upload/complete`, {
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
            timestamp: returnedData.timestamp,
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

        return { success: true, messageData: returnedData };

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

        // 如果是相对路径，构建完整URL
        let fullUrl = fileUrl;
        if (!fileUrl.startsWith('http')) {
            fullUrl = `${SOCKET_SERVER_URL}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}/${String(isGroup)}`;
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
                await db(isGroup ? 'group_messages' : 'messages')
                    .where('id', messageId)
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

ipcMain.handle('delete-contact', async (event, { contactId }) => {
    if (!db) {
        return { success: false, error: '数据库未连接' };
    }
    try {
        socket.emit('delete-contact', contactId);
        const deleted = await db('friends')
            .where('id', contactId)
            .update({ isFriend: false });
        return { success: true, deleted };

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

    if (contact.type == 'group') {
        const deleted = await db('group_messages')
            .where('group_id', contactId)
            .del();
        return { success: true, deleted };
    }
    else {
        const deleted = await db('messages')
            .where('receiver_id', contactId)
            .orWhere('sender_id', contactId)
            .del();
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

                // 向渲染进程发送新邀请接收信号
                event.sender.send('receive-new-invite');
            }
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
                        update_time: timestamp
                    });

                // 向渲染进程发送新邀请接收信号
                event.sender.send('receive-new-invite');
            }
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
            event.sender.send('friends-list-updated');
        }
    } catch (error) {
        console.error('接受好友请求失败:', error);
        // 向渲染进程发送错误信息
        event.sender.send('friend-request-accept-error', {
            error: error.message
        });
    }
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
            event.sender.send('group-invite-accepted', { requestId });
            event.sender.send('groups-list-updated');
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


ipcMain.handle('get-friends-list', async () => {
    if (!db) {
        return [];
    }
    const friends = await db('friends')
        .select('id', 'userName')
    return friends;
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


ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const data = fs.readFileSync(filePath);
        return data.toString('base64');
    } catch (error) {
        console.error('Failed to read file:', error);
        return null;
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

ipcMain.on('logout', () => {
    store.delete('currentUserCredentials');
    app.relaunch();
    app.exit();
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
