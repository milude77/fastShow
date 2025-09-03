const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  chatMessage: (contactId, currentUserID, msg) => ipcRenderer.send('chat-message', { contactId, currentUserID, msg }),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getChatHistory: (contactId, currentUserID, page, pageSize) => ipcRenderer.invoke('get-chat-history', { contactId, currentUserID, page, pageSize }),
  openSearchWindow: (userId) => ipcRenderer.send('open-search-window', userId),
  openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
  
  showErrowMessage: (message) => ipcRenderer.send('show-error-window', message),
  receiveErrorMessage: (callback) => ipcRenderer.on('error-message', (event, message) => callback(message)),
  removeErrorListeners: () => ipcRenderer.removeAllListeners('error-message'),

  loginSuccess: (userId)=> ipcRenderer.send('login-success', userId),
  saveCurrentUserCredentials: (credentials) => ipcRenderer.send('save-current-user-credentials', credentials),
  getCurrentUserCredentials: () => ipcRenderer.invoke('get-current-user-credentials'),

  saveUserListCredentials: (credentials) => ipcRenderer.send('save-user-credentials-list', credentials),
  getUserListCredentials: () => ipcRenderer.invoke('get-user-credentials-list'),
  switchUser: (switchUserId) => ipcRenderer.send('switch-user', switchUserId),
  logout: () => ipcRenderer.send('logout'),

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
