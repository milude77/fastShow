import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

const isDev = process.env.NODE_ENV === "development"

// 定义聊天记录文件的路径
const chatHistoryPath = path.join(app.getPath('userData'), 'chatHistory.json');

// 读取聊天记录
function readChatHistory() {
    try {
        if (fs.existsSync(chatHistoryPath)) {
            const data = fs.readFileSync(chatHistoryPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to read chat history:', error);
    }
    return [];
}

// 写入聊天记录
function writeChatHistory(history) {
    try {
        fs.writeFileSync(chatHistoryPath, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error('Failed to write chat history:', error);
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

ipcMain.on('chat-message', (event, msg) => {
    console.log('收到前端消息:', msg);
    const history = readChatHistory();
    history.push(msg);
    writeChatHistory(history);
    // 可以在这里广播给所有窗口，或做后端处理
    event.reply('chat-reply', msg);
});

ipcMain.handle('get-chat-history', () => {
    return readChatHistory();
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})
