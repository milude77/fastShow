const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (contactId, msg) => ipcRenderer.send('chat-message', { contactId, msg }),
  onReply: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('chat-reply', handler);
    return () => ipcRenderer.removeListener('chat-reply', handler);
  },
  removeChatListener: () => {
    ipcRenderer.removeAllListeners('chat-reply');
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getChatHistory: (contactId) => ipcRenderer.invoke('get-chat-history', contactId)
});
