import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { io } from 'socket.io-client';

const isDev = process.env.NODE_ENV === "development"

// --- Socket.IO Main Process Setup ---
const SOCKET_SERVER_URL = 'http://localhost:3001';
let socket;
// --- End Socket.IO Setup ---

// 获取指定联系人的聊天记录文件路径
function getChatHistoryPath(contactId) {
    return path.join(app.getPath('userData'), `chatHistory_${contactId}.json`);
}

// 读取指定联系人的所有聊天记录
function readAllChatHistory(contactId) {
    const chatHistoryPath = getChatHistoryPath(contactId);
    try {
        if (fs.existsSync(chatHistoryPath)) {
            const data = fs.readFileSync(chatHistoryPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(`Failed to read all chat history for contact ${contactId}:`, error);
    }
    return [];
}

// 读取指定联系人的聊天记录
function readChatHistory(contactId, page = 1, pageSize = 20) {
    const chatHistoryPath = getChatHistoryPath(contactId);
    try {
        if (fs.existsSync(chatHistoryPath)) {
            const data = fs.readFileSync(chatHistoryPath, 'utf8');
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
function writeChatHistory(contactId, history) {
    const chatHistoryPath = getChatHistoryPath(contactId);
    try {
        fs.writeFileSync(chatHistoryPath, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error(`Failed to write chat history for contact ${contactId}:`, error);
    }
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
    
    console.log(`Loading URL: ${searchUrl}`);
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

ipcMain.on('chat-message', (event, { contactId, msg }) => {
    console.log(`收到来自 ${contactId} 的消息:`, msg);
    const history = readAllChatHistory(contactId); // 使用新函数读取完整的历史记录
    history.push(msg);
    writeChatHistory(contactId, history);
    // 可以在这里广播给所有窗口，或做后端处理
    event.reply('chat-reply', { contactId, msg });
});

ipcMain.handle('get-chat-history', (event, { contactId, page, pageSize }) => {
    return readChatHistory(contactId, page, pageSize);
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.on('open-search-window', (event, userId) => {
    console.log(`IPC event 'open-search-window' received with userId: ${userId}`);
    createSearchWindow(userId);
});

// --- IPC Handlers for Socket.IO ---
// Listen for a renderer to send a message
ipcMain.on('socket-emit', (event, { event: eventName, args }) => {
  if (socket && socket.connected) {
    console.log(`Received socket-emit '${eventName}' from renderer, sending to server.`);
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
