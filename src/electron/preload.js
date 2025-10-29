const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  chatMessage: (contactId, currentUserID, msg) => ipcRenderer.send('chat-message', { contactId, currentUserID, msg }),
  sendMessageStatusChange: (senderInfo, sendMessageId, receiverId, status, isGroup) => ipcRenderer.send('message-sent-status', { senderInfo, sendMessageId, receiverId, status, isGroup }),
  resendMessage: (messageId) => ipcRenderer.invoke('resend-message', { messageId }),
  // 触发文件选择对话框，并返回文件路径
  selectFile: () => ipcRenderer.invoke('select-file'),
  // 使用新的MinIO上传流程
  initiateFileUpload: (filePath, senderId, receiverId) => ipcRenderer.invoke('initiate-file-upload', { filePath, senderId, receiverId }),
  getDropFilePath: (droppedFiles) => {
    try {
      const list = Array.isArray(droppedFiles) ? droppedFiles : Array.from(droppedFiles || []);
      const filePaths = [];
      for (const f of list) {
        const p = webUtils.getPathForFile(f);
        if (p) filePaths.push(p);
      }
      return filePaths;
    } catch (error) {
      console.error('Failed to get drop file path:', error);
      return null;
    }
  },
  downloadFile: (fileUrl, fileName) => ipcRenderer.invoke('download-file', { fileUrl, fileName }),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  openFileLocation: (messageId) => ipcRenderer.invoke('open-file-location', { messageId }),
  checkFileExists: (messageId) => ipcRenderer.invoke('check-file-exists', { messageId }),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getChatHistory: (contactId, currentUserID, page, pageSize, isGroup) => ipcRenderer.invoke('get-chat-history', { contactId, currentUserID, page, pageSize, isGroup }),
  openSearchWindow: (userId, selectInformation) => ipcRenderer.send('open-search-window', { userId, selectInformation }),
  openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
  openCreateGroupWindow:(currentID)=> ipcRenderer.send('open-create-group-window',{currentID}),
  
  showErrowMessage: (message) => ipcRenderer.send('show-error-window', message),
  receiveErrorMessage: (callback) => ipcRenderer.on('error-message', (event, message) => callback(message)),
  removeErrorListeners: () => ipcRenderer.removeAllListeners('error-message'),

  loginSuccess: (userId)=> ipcRenderer.send('login-success', userId),
  saveCurrentUserCredentials: (credentials) => ipcRenderer.send('save-current-user-credentials', credentials),
  getCurrentUserCredentials: () => ipcRenderer.invoke('get-current-user-credentials'),
  getFriendsList: () => ipcRenderer.invoke('get-friends-list'),

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
