import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { io } from 'socket.io-client';
import Store from 'electron-store';

const isDev = process.env.NODE_ENV === "development"
const store = new Store();

// --- Socket.IO Main Process Setup ---
const SOCKET_SERVER_URL = 'http://localhost:3001';
let socket;
// --- End Socket.IO Setup ---


// 获取指定联系人的聊天记录文件路径
function getChatHistoryPath(contactId, currentUserID) {
    return path.join(app.getPath('userData'), `${currentUserID}` ,`chatHistory_${contactId}.json`);
}

// 读取指定联系人的所有聊天记录
function readAllChatHistory(contactId ,currentUserID) {
    const chatHistoryPath = getChatHistoryPath(contactId, currentUserID);
    try {
        if (fs.existsSync(chatHistoryPath)) {
            const data = fs.readFileSync(chatHistoryPath, { encoding: 'utf8' });
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(`Failed to read all chat history for contact ${contactId}:`, error);
    }
    return [];
}

// 读取指定联系人的聊天记录
function readChatHistory(contactId, currentUserID, page = 1, pageSize = 20) {
    const chatHistoryPath = getChatHistoryPath(contactId, currentUserID);
    try {
        if (fs.existsSync(chatHistoryPath)) {
            const data = fs.readFileSync(chatHistoryPath, { encoding: 'utf8' });
            const history = JSON.parse(data);
            // 实现分页逻辑
            const totalMessages = history.length;
            const startIndex = Math.max(0, totalMessages - (page * pageSize));
            const endIndex = Math.max(0, totalMessages - ((page - 1) * pageSize));
            return history.slice(startIndex, endIndex);
        }
    } catch (error) {
        console.error(`Failed to read chat history for contact ${contactId}:`, error);
    }
    return [];
}

// 写入指定联系人的聊天记录
function writeChatHistory(contactId, currentUserID, history) {
    const chatHistoryPath = getChatHistoryPath(contactId, currentUserID);
    const userFolderPath = path.dirname(chatHistoryPath); // Get the directory path
    try {
        // Ensure the user's directory exists before writing the file
        fs.mkdirSync(userFolderPath, { recursive: true });
        fs.writeFileSync(chatHistoryPath, JSON.stringify(history, null, 2), { encoding: 'utf8' });
    } catch (error) {
        console.error(`Failed to write chat history for contact ${contactId}:`, error);
    }
}

function createSettingsWindow() {
    const settingsWindow = new BrowserWindow({
        width: 500,
        height: 400,
        parent: BrowserWindow.getAllWindows()[0], // 设置父窗口
        modal: true, // 设置为模态窗口
        webPreferences: {
            preload: path.join(app.getAppPath(), "src", "electron", "preload.js"),
            devTools: isDev
        }
    });
    const settingsUrl = isDev
        ? `http://localhost:5234/settings.html`
        : `file://${path.join(app.getAppPath(), "dist", "settings.html")}`;
    
    settingsWindow.loadURL(settingsUrl).catch(err => console.error('Failed to load settings URL:', err));
    
    if(isDev) {
        settingsWindow.webContents.openDevTools();
    }

    settingsWindow.setMenu(null);
}

function createSearchWindow(userId) {
    console.log(`Attempting to create search window for user ID: ${userId}`);
    const searchWindow = new BrowserWindow({
        width: 500,
        height: 400,
        parent: BrowserWindow.getAllWindows()[0], // 设置父窗口
        modal: true, // 设置为模态窗口
        webPreferences: {
            preload: path.join(app.getAppPath(), "src", "electron", "preload.js"),
            devTools: isDev
        }
    });

    const searchUrl = isDev
        ? `http://localhost:5234/search.html?userId=${userId}`
        : `file://${path.join(app.getAppPath(), "dist", "search.html")}?userId=${userId}`;
    
    searchWindow.loadURL(searchUrl).catch(err => console.error('Failed to load search URL:', err));
    
    if(isDev) {
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
}

app.whenReady().then(() => {
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
    console.log(`Received socket event '${event}' from server, forwarding to renderers.`);
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

ipcMain.on('chat-message', (event, { contactId, currentUserID, msg }) => {
    // Safety check to prevent writing undefined data
    if (!msg) {
        console.error('Received chat-message with undefined msg object.');
        return;
    }
    console.log(`Received chat message for user ${currentUserID} with contact ${contactId}:`, msg);
    const history = readAllChatHistory(contactId, currentUserID); 
    history.push(msg);
    writeChatHistory(contactId, currentUserID, history);
});

ipcMain.handle('get-chat-history', (event, { contactId, currentUserID, page, pageSize }) => {
    return readChatHistory(contactId, currentUserID, page, pageSize);
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

// --- User Credentials IPC Handlers ---
ipcMain.on('save-user-credentials-list', (event, credentials) => {
    store.delete('userCredentials');
    let originalUserList = store.get('userCredentials') || {};
    originalUserList[credentials.userId] = {
        userName: credentials.userName,
        jwt: credentials.token
    };
    store.set('userCredentials', originalUserList);
});

ipcMain.handle('get-user-credentials-list', () => {
    return store.get('userCredentials');
});

ipcMain.on('save-current-user-credentials', (event, credentials) => {
    store.set('currentUserCredentials', credentials);
});

ipcMain.handle('get-current-user-credentials', () => {
    return store.get('currentUserCredentials');
});

ipcMain.on('switch-user', () => {
    store.delete('currentUserCredentials');
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
