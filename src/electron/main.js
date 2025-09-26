import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { io } from 'socket.io-client';
import Store from 'electron-store';
import knex from 'knex';
import fs from 'fs';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';
import { console } from 'inspector/promises';



const isDev = process.env.NODE_ENV === "development"
const store = new Store();

// --- Socket.IO Main Process Setup ---
const config = JSON.parse(readFileSync('./config.json'));
const SOCKET_SERVER_URL = config.SOCKET_SERVER_URL;
let socket;
let heartbeatInterval;
let reconnectionTimer;
let heartbeatTimeout;


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
        // If connection fails, also attempt to reconnect after a delay
        if (!reconnectionTimer) { // Only start a new timer if one isn't already running
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
                console.log('Heartbeat timeout. Disconnecting.');
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

async function initializeDatabase(db) {
    try {
        console.log('Initializing database...');

        // 检查表是否存在，使用更可靠的方法
        let exists;
        try {
            exists = await db.schema.hasTable('messages');
            console.log('Messages table exists:', exists);
        } catch (error) {
            console.log('Error checking if messages table exists:', error.message);
            exists = false;
        }

        if (!exists) {
            console.log('Creating messages table...');

            // 使用 await 确保表创建完成
            await db.schema.createTable('messages', (table) => {
                table.string('id').primary();
                table.string('sender_id').notNullable();
                table.string('receiver_id').notNullable();
                table.text('text').notNullable();
                table.timestamp('timestamp').defaultTo(db.fn.now());
                table.string('username').notNullable();
                table.string('sender').notNullable().defaultTo('user');
                table.string('messageType').defaultTo('text');
                table.string('fileName').nullable();
                table.string('fileUrl').nullable();
                table.string('fileSize').nullable();
                table.string('localFilePath').nullable();
                table.boolean('fileExt').nullable().defaultTo(false);
            });

            console.log('Messages table created successfully');

            // 验证表是否真的创建成功
            const tablesExist = await db.schema.hasTable('messages');
            console.log('Verified messages table exists:', tablesExist);
        } else {
            console.log('Messages table already exists');
        }
    } catch (error) {
        console.error('Failed to initialize database:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sql: error.sql,
            bindings: error.bindings
        });
        throw error; // 重新抛出错误
    }
}

// 读取指定联系人的聊天记录
async function readChatHistory(contactId, currentUserID, page = 1, pageSize = 20) {
    try {
        console.log('Reading chat history for contact:', contactId, 'page:', page);

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

        console.log(`Found ${history.length} messages for contact ${contactId}`);
        return history.reverse(); // 保证消息按时间升序排列
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
        const exists = await db.schema.hasTable('messages');
        if (!exists) {
            await initializeDatabase(db);
        }

        // 确保所有必需字段都存在并转换为正确的类型
        const messageData = {
            id: msg.id,
            sender_id: currentUserID,
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
            localFilePath: msg.localFilePath || null
        };

        await db('messages').insert(messageData);

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

function createMainWindow() {
    const mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        frame: false,
        webPreferences: {
            preload: path.join(app.getAppPath(), "src", "electron", "preload.js"),
            devTools: isDev
        }
    })
    if (isDev) {
        mainWindow.loadURL("http://localhost:5234");
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
    }
    mainWindow.setMenu(null); // 隐藏菜单栏

    mainWindow.on('closed', () => {
        app.quit();
    });
}

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
        console.log('Login success event received for user:', userID);

        const userDbPath = path.join(app.getPath('userData'), `${userID}`);

        if (!fs.existsSync(userDbPath)) {
            fs.mkdirSync(userDbPath, { recursive: true });
            console.log('Created user database directory:', userDbPath);
        }

        dbPath = path.join(userDbPath, 'chat_history.sqlite3');
        console.log('Database path:', dbPath);

        // 创建数据库连接
        db = knex({
            client: 'sqlite3',
            connection: {
                filename: dbPath,
            },
            useNullAsDefault: true
        });

        console.log('Database connection created');

        // 初始化数据库（确保表存在）
        await initializeDatabase(db);


        console.log('Database initialization completed');
    } catch (error) {
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

ipcMain.handle('get-chat-history', async (event, { contactId, currentUserID, page, pageSize }) => {
    return await readChatHistory(contactId, currentUserID, page, pageSize);
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


ipcMain.handle('upload-file', async (event, { contactId, currentUserID, fileName, fileContent }) => {
    try {
        const response = await fetch(`${SOCKET_SERVER_URL}/api/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName,
                fileContent,
                receiverId: contactId,
                senderId: currentUserID
            })
        });
        if (!response.ok) {
            throw new Error('文件上传失败');
        }

        const result = await response.json();
        return { success: true, filePath: result.filePath };
    } catch (error) {
        console.error('Failed to upload file:', error);
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
            throw new Error(`下载失败: ${response.statusText}`);
        }

        // 将文件内容写入本地
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        // 打开文件资源管理器并选中文件
        shell.showItemInFolder(filePath);

        // 更新数据库中的文件存在状态和本地文件路径
        try {
            if (db) {
                // 根据fileUrl查找并更新fileExt状态和本地文件路径
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
// --- End Socket.IO IPC ---

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})
