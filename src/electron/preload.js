const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  chatMessage: (contactId, currentUserID, msg) => ipcRenderer.send('chat-message', { contactId, currentUserID, msg }),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getChatHistory: (contactId, currentUserID, page, pageSize) => ipcRenderer.invoke('get-chat-history', { contactId, currentUserID, page, pageSize }),
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
