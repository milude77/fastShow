const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  newChatMessage: (contactId, msg) => ipcRenderer.send('new-chat-message', { contactId, msg }),
  getNewMessageId: () => ipcRenderer.invoke('get-new-message-id'),
  sendPrivateMessage: ( { receiverId, message, messageId } ) => ipcRenderer.send('send-private-message', { receiverId, message, messageId }),
  sendGroupMessage: ( { groupId, message, messageId } ) => ipcRenderer.send('send-group-message', { groupId, message, messageId }),
  sendMessageStatusChange: (senderInfo, sendMessageId, isGroup) => ipcRenderer.send('message-sent-status', { senderInfo, sendMessageId, isGroup }),
  resendMessage: (messageId) => ipcRenderer.invoke('resend-message', { messageId }),
  getLastMessage: (contactId, isGroup) => ipcRenderer.invoke('get-last-message', { contactId, isGroup }),
  getUnreadMessageCount: (contactId, isGroup) => ipcRenderer.invoke('get-unread-message-count', { contactId, isGroup }),
  clearUnreadMessageCount: (contactId, isGroup) => ipcRenderer.send('clear-unread-message-count', { contactId, isGroup }),
  getAllUnreadMessageCount: () => ipcRenderer.invoke('get-all-unread-message-count'),
  getUserAvatarPath: () => ipcRenderer.invoke('get-user-avatar-path'),
  saveAvatarLocally: (avatarArrayBuffer) => ipcRenderer.invoke('save-avatar-locally', avatarArrayBuffer),
  // 触发文件选择对话框，并返回文件路径
  selectFile: () => ipcRenderer.invoke('select-file'),
  // 使用新的MinIO上传流程
  initiateFileUpload: (filePath, senderId, receiverId, isGroup, messageId) => ipcRenderer.invoke('initiate-file-upload', { filePath, senderId, receiverId, isGroup, messageId }),
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
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  downloadFile: (messageId, fileUrl, fileName, isGroup) => ipcRenderer.invoke('download-file', { messageId, fileUrl, fileName, isGroup }),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  openFileLocation: (messageId, isGroup) => ipcRenderer.invoke('open-file-location', { messageId, isGroup }),
  checkFileExists: (messageId, isGroup) => ipcRenderer.invoke('check-file-exists', { messageId, isGroup }), 
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getChatHistory: (contactId, currentUserID, pageSize, isGroup, beforeTimestamp) => ipcRenderer.invoke('get-chat-history', { contactId, currentUserID, pageSize, isGroup, beforeTimestamp }),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  getInviteInformationList: () => ipcRenderer.invoke('get-invite-information-list'),
  openSearchWindow: (userId, selectInformation) => ipcRenderer.send('open-search-window', { userId, selectInformation }),
  openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
  deleteContact: (contactId) => ipcRenderer.invoke('delete-contact', { contactId }),
  deleteContactMessageHistory: (contact) => ipcRenderer.invoke('delete-contact-message-history', { contact }),
  leaveGroup: (groupId, currentUserID) => ipcRenderer.invoke('leave-group', { groupId, currentUserID }),

  loginSuccess: ({ userId, token }) => ipcRenderer.send('login-success', { userId, token}),
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
  strongLogoutWaring: (message) => ipcRenderer.send('strong-logout-waring', message),
  logout: () => ipcRenderer.send('logout'),

  // --- Window Controls ---
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height }),
  toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),
  getInitialIsPinned: () => ipcRenderer.invoke('get-initial-always-on-top'),
  getCurTheme: () => ipcRenderer.invoke('get-cur-theme'),
  toggleTheme: (theme) => ipcRenderer.send('toggle-theme', theme),

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
