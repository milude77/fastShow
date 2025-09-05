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

  // --- Window Controls ---
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),

  // --- Socket.IO IPC ---
  socketEmit: (event, ...args) => {
    ipcRenderer.send('socket-emit', { event, args });
  },
  getSocketStatus: () => ipcRenderer.invoke('get-socket-status'), // 新增：获取 socket 连接状态
  socketOn: (event, callback) => {
    // This handler is for generic socket events forwarded from the main process
    const genericHandler = (e, data) => {
      // Check if the event name matches what the listener is for
      if (data.event === event) {
        // If there are args, spread them. Otherwise, send the whole data object.
        // This handles both regular socket events and our custom status events.
        if (data.args) {
          callback(...data.args);
        } else {
          callback(data); // Pass the whole object for events like 'disconnect'
        }
      }
    };
    ipcRenderer.on('socket-event', genericHandler);

    return () => ipcRenderer.removeListener('socket-event', genericHandler);
  }
  // --- End Socket.IO IPC ---
});
