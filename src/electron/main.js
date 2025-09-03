import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { io } from 'socket.io-client';
import Store from 'electron-store';
import knex from 'knex';
import { console } from 'inspector';
import fs from 'fs';

const isDev = process.env.NODE_ENV === "development"
const store = new Store();

// --- Socket.IO Main Process Setup ---
const SOCKET_SERVER_URL = 'http://localhost:3001';
let socket;
// --- End Socket.IO Setup ---

let dbPath;
let db;

async function initializeDatabase(db) {
    const exists = await db.schema.hasTable('messages');
    try {
        if (!exists) {
            await db.schema.createTable('messages', (table) => {
                table.string('id').primary();
                table.integer('sender_id').unsigned().references('id').inTable('users').notNullable();
                table.integer('receiver_id').unsigned().references('id').inTable('users').notNullable();
                table.text('text').notNullable();
                table.timestamp('timestamp').defaultTo(db.fn.now());
                table.string('username').notNullable();
                table.string('sender').notNullable().defaultTo('user');
            });
        }
    }
    catch (error) {
        console.error('Failed to initialize database:', error);
    }
}

// 读取指定联系人的聊天记录
async function readChatHistory(contactId, currentUserID, page = 1, pageSize = 20) {
    try {
        const exists = await db.schema.hasTable('messages');
        if (!exists) {
            return [];
        }

        const offset = (page - 1) * pageSize;

        const history = await db('messages')
            .select('*')
            .where(function() {
                this.where('sender_id', currentUserID).andWhere('receiver_id', contactId);
            })
            .orWhere(function() {
                this.where('sender_id', contactId).andWhere('receiver_id', currentUserID);
            })
            .orderBy('timestamp', 'desc')
            .limit(pageSize)
            .offset(offset);
        
        return history.reverse(); // 保证消息按时间升序排列
    } catch (error) {
        console.error(`Failed to read chat history for contact ${contactId}:`, error);
        return [];
    }
}

// 写入指定联系人的聊天记录
async function writeChatHistory(contactId, currentUserID, msg) {
    const exists = await db.schema.hasTable('messages');
    if  (!exists) return 
    try {
        await db('messages').insert({
            id: msg.id,
            sender_id: currentUserID,
            receiver_id: contactId,
            text: msg.text,
            username: msg.username,
            timestamp: msg.timestamp,
            sender: msg.sender
        });
    }catch (error) {
        console.error(`Failed to write chat history for contact ${contactId}:`, error);
    }
}
    // await db.schema.createTable('messages', (table) => {
    //     table.string('id').primary();
    //     table.integer('sender_id').unsigned().references('id').inTable('users').notNullable();
    //     table.integer('receiver_id').unsigned().references('id').inTable('users').notNullable();
    //     table.text('text').notNullable();
    //     table.timestamp('timestamp').defaultTo(db.fn.now());
    //     table.string('username').notNullable();
    //     table.string('sender').notNullable().defaultTo('user');
    // });
    


function createSettingsWindow() {
    const settingsWindow = new BrowserWindow({
        width: 500,
        height: 400,
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
}

function createSearchWindow(userId) {
    const searchWindow = new BrowserWindow({
        width: 500,
        height: 400,
        webPreferences: {
            preload: path.join(app.getAppPath(), "src", "electron", "preload.js"),
            devTools: isDev
        }
    });

    const searchUrl = isDev
        ? `http://localhost:5234/search.html?userId=${userId}`
        : `file://${path.join(app.getAppPath(), "dist", "search.html")}?userId=${userId}`;

    searchWindow.loadURL(searchUrl).catch(err => console.error('Failed to load search URL:', err));

    if (isDev) {
        searchWindow.webContents.openDevTools();
    }

    searchWindow.setMenu(null);
}

function createMainWindow() {
    const mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
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
    socket = io(SOCKET_SERVER_URL);

    socket.on('connect', () => {
        console.log('Socket connected to server in main process:', socket.id);
        // Notify all windows that connection is established
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('socket-event', { event: 'connect', id: socket.id });
        });
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected from server in main process');
        // Notify all windows
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('socket-event', { event: 'disconnect' });
        });
    });

    // Generic listener to forward all server events to renderer processes
    socket.onAny((event, ...args) => {
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('socket-event', { event, args });
        });
    });
    // --- End Socket.IO Connection ---

    createMainWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
})

ipcMain.on('login-success', (event, userID) => {
    const userDbPath = path.join(app.getPath('userData'), `${userID}`);

    if (!fs.existsSync(userDbPath)) {
        fs.mkdirSync(userDbPath, { recursive: true });
    }
    dbPath = path.join(userDbPath, 'chat_history.sqlite3');

    db = knex({
        client: 'sqlite3',
        connection: {
            filename: dbPath,
        },
        useNullAsDefault: true
    });

    initializeDatabase(db)
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

ipcMain.on('open-search-window', (event, userId) => {
    createSearchWindow(userId);
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
    console.log('Saved user credentials list:', store.get('userCredentials'));
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

ipcMain.on('logout', () => {
    store.delete('currentUserCredentials');
    app.relaunch();
    app.exit();
});
// --- End User Credentials IPC Handlers ---

// --- IPC Handlers for Socket.IO ---
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
// --- End IPC Handlers ---

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})
