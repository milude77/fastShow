const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  chatMessage: (contactId, currentUserID, msg) => ipcRenderer.send('chat-message', { contactId, currentUserID, msg }),
  uploadFile: (contactId, currentUserID, fileName, fileContent) => ipcRenderer.invoke('upload-file', { contactId, currentUserID, fileName, fileContent }),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getChatHistory: (contactId, currentUserID, page, pageSize) => ipcRenderer.invoke('get-chat-history', { contactId, currentUserID, page, pageSize }),
  openSearchWindow: (userId, selectInformation) => ipcRenderer.send('open-search-window', { userId, selectInformation }),
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
  deleteUser: (removeUserId) => ipcRenderer.send('delete-saved-user', removeUserId),
  logout: () => ipcRenderer.send('logout'),

  // --- Window Controls ---
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),
  getInitialIsPinned: () => ipcRenderer.invoke('get-initial-always-on-top'),
  onAlwaysOnTopChanged: (callback) => {
    const handler = (event, isAlwaysOnTop) => callback(isAlwaysOnTop);
    
    ipcRenderer.on('always-on-top-changed', handler);
    
    return () => {
      ipcRenderer.removeListener('always-on-top-changed', handler);
    };
  },

  // --- Socket.IO IPC ---
  socketEmit: (event, ...args) => {
    ipcRenderer.send('socket-emit', { event, args });
  },
  getSocketStatus: () => ipcRenderer.invoke('get-socket-status'), // 新增：获取 socket 连接状态
  socketOn: (event, callback) => {
    const genericHandler = (e, data) => {
      if (data.event === event) {
        if (data.args) {
          callback(...data.args);
        } else {
          callback(data); 
        }
      }
    };
    ipcRenderer.on('socket-event', genericHandler);

    return () => ipcRenderer.removeListener('socket-event', genericHandler);
  }
  // --- End Socket.IO IPC ---
});
