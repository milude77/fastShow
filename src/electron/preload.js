const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (contactId, msg) => ipcRenderer.send('send-chat-message', { contactId, msg }),
  receiverMessage:(contactId, msg) => ipcRenderer.send('receiver-chat-message', { contactId, msg }),
  onReply: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('chat-reply', handler);
    return () => ipcRenderer.removeListener('chat-reply', handler);
  },
  removeChatListener: () => {
    ipcRenderer.removeAllListeners('chat-reply');
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getChatHistory: (contactId, page, pageSize) => ipcRenderer.invoke('get-chat-history', { contactId, page, pageSize }),
  openSearchWindow: (userId) => ipcRenderer.send('open-search-window', userId),

  // --- Socket.IO IPC ---
  socketEmit: (event, ...args) => {
    ipcRenderer.send('socket-emit', { event, args });
  },
  socketOn: (event, callback) => {
    const handler = (e, data) => {
      if (data.event === event) {
        callback(...data.args);
      }
    };
    ipcRenderer.on('socket-event', handler);
    // Return a function to remove the listener
    return () => ipcRenderer.removeListener('socket-event', handler);
  }
  // --- End Socket.IO IPC ---
});
