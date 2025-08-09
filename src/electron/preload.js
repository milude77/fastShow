const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (msg) => ipcRenderer.send('chat-message', msg),
  onReply: (callback) => {
    return ipcRenderer.on('chat-reply', (event, data) => callback(data));
  },
  removeChatListener: () => {
    ipcRenderer.removeAllListeners('chat-reply');
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getChatHistory: () => ipcRenderer.invoke('get-chat-history')
});
