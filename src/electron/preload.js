const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  chatMessage: (contactId, msg) => ipcRenderer.send('chat-message', { contactId, msg }),
  sendPrivateMessage: ( { receiverId, message } ) => ipcRenderer.invoke('send-private-message', { receiverId, message }),
  sendGroupMessage: ( { groupId, message } ) => ipcRenderer.invoke('send-group-message', { groupId, message }),
  sendMessageStatusChange: (senderInfo, sendMessageId, isGroup) => ipcRenderer.send('message-sent-status', { senderInfo, sendMessageId, isGroup }),
  resendMessage: (messageId) => ipcRenderer.invoke('resend-message', { messageId }),
  // 触发文件选择对话框，并返回文件路径
  selectFile: () => ipcRenderer.invoke('select-file'),
  // 使用新的MinIO上传流程
  initiateFileUpload: (filePath, senderId, receiverId, isGroup) => ipcRenderer.invoke('initiate-file-upload', { filePath, senderId, receiverId, isGroup }),
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
  getChatHistory: (contactId, currentUserID, pageSize, isGroup, beforeTimestamp) => ipcRenderer.invoke('get-chat-history', { contactId, currentUserID, pageSize, isGroup, beforeTimestamp }),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  getInviteInformationList: () => ipcRenderer.invoke('get-invite-information-list'),
  openSearchWindow: (userId, selectInformation) => ipcRenderer.send('open-search-window', { userId, selectInformation }),
  openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
  deleteContact: (contactId) => ipcRenderer.invoke('delete-contact', { contactId }),
  deleteContactMessageHistory: (contact) => ipcRenderer.invoke('delete-contact-message-history', { contact }),
  leaveGroup: (groupId, currentUserID) => ipcRenderer.invoke('leave-group', { groupId, currentUserID }),

  showErrowMessage: (message) => ipcRenderer.send('show-error-window', message),
  receiveErrorMessage: (callback) => ipcRenderer.on('error-message', (event, message) => callback(message)),
  removeErrorListeners: () => ipcRenderer.removeAllListeners('error-message'),

  loginSuccess: (userId) => ipcRenderer.send('login-success', userId),
  saveCurrentUserCredentials: (credentials) => ipcRenderer.send('save-current-user-credentials', credentials),
  getCurrentUserCredentials: () => ipcRenderer.invoke('get-current-user-credentials'),
  getFriendsList: () => ipcRenderer.invoke('get-friends-list'),
  acceptGroupInvite: (requesterId) => ipcRenderer.send('accept-group-invite', requesterId),
  acceptFriendRequest: (requesterId) => ipcRenderer.send('accept-friend-request', requesterId),
  getInviteinformationList: () => ipcRenderer.invoke('get-invite-information-list'),
  saveInviteinformationList: (credentials) => ipcRenderer.send('save-invite-information-list', credentials),

  saveUserListCredentials: (credentials) => ipcRenderer.send('save-user-credentials-list', credentials),
  getUserListCredentials: () => ipcRenderer.invoke('get-user-credentials-list'),
  switchUser: (switchUserId) => ipcRenderer.send('switch-user', switchUserId),
  deleteUser: (removeUserId) => ipcRenderer.send('delete-saved-user', removeUserId),
  logout: () => ipcRenderer.send('logout'),

  // --- Window Controls ---
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height }),
  toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),
  getInitialIsPinned: () => ipcRenderer.invoke('get-initial-always-on-top'),


  ipcRenderer: {
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener);
    },
    removeListener: (channel, listener) => {
      ipcRenderer.removeListener(channel, listener);
    },
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
