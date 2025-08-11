import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

const isDev = process.env.NODE_ENV === "development"

// 获取指定联系人的聊天记录文件路径
function getChatHistoryPath(contactId) {
    return path.join(app.getPath('userData'), `chatHistory_${contactId}.json`);
}

// 读取指定联系人的聊天记录
function readChatHistory(contactId) {
    const chatHistoryPath = getChatHistoryPath(contactId);
    try {
        if (fs.existsSync(chatHistoryPath)) {
            const data = fs.readFileSync(chatHistoryPath, 'utf8');
            return JSON.parse(data);
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
  createMainWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

ipcMain.on('chat-message', (event, { contactId, msg }) => {
    console.log(`收到来自 ${contactId} 的消息:`, msg);
    const history = readChatHistory(contactId);
    history.push(msg);
    writeChatHistory(contactId, history);
    // 可以在这里广播给所有窗口，或做后端处理
    event.reply('chat-reply', { contactId, msg });
});

ipcMain.handle('get-chat-history', (event, contactId) => {
    return readChatHistory(contactId);
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})
