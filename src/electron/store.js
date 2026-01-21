import Store from 'electron-store';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义配置结构和默认值
const schema = {
  userCredentials: {
    type: 'object',
    default: {}
  },
  userAssets: {
    type: 'object',
    default: {}
  },
  currentUserCredentials: {
    type: 'object',
    default: null,
    nullable: true
  },
  settings: {
    type: 'object',
    default: {
      autoLogin: true,
      showNotifications: true,
      theme: 'light',
      fontSize: 14,
      maxChatHistory: 1000,
      uploadLimitMB: 50,
      autoCheckUpdate: true,
      enableEmoji: true,
      enableMarkdown: true,
      serverTimeout: 30000,
      language: 'zh-CN',
      autoStart: false
    }
  },
  appConfig: {
    type: 'object',
    default: {
      firstRun: true,
      version: '1.0.0',
      lastCheckUpdate: null,
      enableAutoReply: false,
      autoReplyMessage: '我现在不在，稍后回复您。',
      messageRetentionDays: 30
    }
  },
  dbMigrationVersions: {
    type: 'object',
    default: {}
  }
};

// 创建 Store 实例
const store = new Store({ schema });

export const userMessageDraftManager = {
  saveUserMessageDraft: (userId, contactId ,message, isGroup) => {
    const key = `userMessageDrafts.${userId}.${contactId}${isGroup ? '.group' : 'friend'}`;

    store.set(key, message);
  },
  getUserMessageDraft: (userId, contactId, isGroup) => {
    const key = `userMessageDrafts.${userId}.${contactId}${isGroup ? '.group' : 'friend'}`;
    const draft = store.get(key) || '';
    return draft ;
  }
}

// 用户凭证管理
export const userCredentialsManager = {
  // 保存用户凭证列表
  saveUserCredentials: (credentials) => {
    const originalUserList = store.get('userCredentials') || {};
    originalUserList[credentials.userId] = {
      userId: credentials.userId,
      userName: credentials.userName,
      token: credentials.token
    };
    store.set('userCredentials', originalUserList);
  },

  // 获取用户凭证列表
  getUserCredentialsList: () => {
    return store.get('userCredentials') || {};
  },

  // 保存当前用户凭证
  saveCurrentCredentials: (credentials) => {
    store.set('currentUserCredentials', {
      userId: credentials.userId,
      userName: credentials.userName,
      token: credentials.token
    });
  },

  // 获取当前用户凭证
  getCurrentCredentials: () => {
    return store.get('currentUserCredentials');
  },

  // 切换用户
  switchUser: (switchUserID) => {
    const userList = store.get('userCredentials') || {};
    store.set('currentUserCredentials', userList[switchUserID]);
  },

  // 删除保存的用户
  deleteUser: (removeUserID) => {
    const userList = store.get('userCredentials') || {};
    delete userList[removeUserID];
    store.set('userCredentials', userList);
  }
};

export const userAssetsManager = {
  // 获取用户资源列表
  getUserAssets: (userId, key) => {
    const assets = store.get('userAssets') || {};
    assets[userId] = assets[userId] || {};
    return assets[userId][key] || '';
  },

  setUserAssets: (userId, key, value) => {
    const assets = store.get('userAssets') || {};
    assets[userId] = assets[userId] || {};
    assets[userId][key] = value;
    store.set('userAssets',  assets);
  },
};

// 应用设置管理
export const settingsManager = {
  // 获取所有设置
  getAllSettings: () => {
    return store.get('settings');
  },

  // 获取单个设置
  getSetting: (key) => {
    return store.get(`settings.${key}`);
  },

  // 更新单个设置
  updateSetting: (key, value) => {
    store.set(`settings.${key}`, value);
  },

  // 更新多个设置
  updateSettings: (settingsObj) => {
    for (const [key, value] of Object.entries(settingsObj)) {
      store.set(`settings.${key}`, value);
    }
  },

  // 重置设置为默认值
  resetSettings: () => {
    store.reset('settings');
  }
};

// 应用配置管理
export const appConfigManager = {
  // 获取应用配置
  getAppConfig: () => {
    return store.get('appConfig');
  },

  // 更新应用配置
  updateAppConfig: (config) => {
    for (const [key, value] of Object.entries(config)) {
      store.set(`appConfig.${key}`, value);
    }
  },

  // 检查是否首次运行
  isFirstRun: () => {
    return store.get('appConfig.firstRun');
  },

  // 标记已运行
  markAsRan: () => {
    store.set('appConfig.firstRun', false);
  }
};

export const unreadMessageManager = {
  getUnreadMessageCount: function (userId, contactId, isGroup) {  // 使用 function
    const key = `unreadMessageCount.${userId}.${contactId}${isGroup ? '.group' : 'friend'}`;
    return store.get(key) || 0;
  },

  getAllUnreadMessageCount: function (userId) {  // 使用 function
    const key = `unreadMessageCount.${userId}.count`;
    const userUnreadCounts = store.get(key);
    return userUnreadCounts || 0;
  },

  setUnreadMessageCount: function (userId, contactId, count, isGroup) {  // 使用 function
    const key = `unreadMessageCount.${userId}.${contactId}${isGroup ? '.group' : 'friend'}`;
    store.set(key, count);
  },

  incrementUnreadMessageCount: function (userId, contactId, isGroup) {  // 使用 function
    const key = `unreadMessageCount.${userId}.${contactId}${isGroup ? '.group' : 'friend'}`;
    const allKey = `unreadMessageCount.${userId}.count`;
    const currentCount = store.get(key) || 0;
    const allCount = store.get(allKey) || 0;
    store.set(key, currentCount + 1);
    store.set(allKey, allCount + 1);
  },

  clearUnreadMessageCount: function (userId, contactId, isGroup) {  // 使用 function
    const key = `unreadMessageCount.${userId}.${contactId}${isGroup ? '.group' : 'friend'}`;
    const count = store.get(key) || 0;
    const allCount = this.getAllUnreadMessageCount(userId);  // ✅ 现在可以使用 this
    const allKey = `unreadMessageCount.${userId}.count`;

    store.set(key, 0);
    store.set(allKey, Math.max(0, allCount - count));  // 防止负数
  },

  clearAllUserUnreadMessages: function (userId) {  // 使用 function
    const key = `unreadMessageCount.${userId}.count`;
    store.delete(key);
  }
};

// 数据库迁移版本管理
export const dbMigrationManager = {
  getMigrationVersion: (userId) => {
    const key = `dbMigrationVersions.${userId}`;
    return store.get(key);
  },

  setMigrationVersion: (userId, version) => {
    const key = `dbMigrationVersions.${userId}`;
    store.set(key, version);
  }
};

// 通用存储操作
export const storageManager = {
  get: (key) => {
    return store.get(key);
  },

  set: (key, value) => {
    store.set(key, value);
  },

  has: (key) => {
    return store.has(key);
  },

  delete: (key) => {
    store.delete(key);
  },

  clear: () => {
    store.clear();
  },

  // 获取整个 store 的内容
  getAll: () => {
    return store.store;
  },

  // 获取 store 文件路径
  getPath: () => {
    return store.path;
  }
};

export const themeManager = {
  getTheme: () => {
    return store.get('settings.theme');
  },

  setTheme: (theme) => {
    store.set('settings.theme', theme);
  }
};

// 初始化默认设置
export const initializeDefaultSettings = () => {
  const defaultSettings = {
    autoLogin: true,
    showNotifications: true,
    theme: 'light',
    maxChatHistory: 1000,
    uploadLimitMB: 50,
    autoCheckUpdate: true,
    enableAutoReply: false,
    autoReplyMessage: '我现在不在，稍后回复您。'
  };

  // 只设置尚未存在的设置
  for (const [key, value] of Object.entries(defaultSettings)) {
    if (!store.has(`settings.${key}`)) {
      store.set(`settings.${key}`, value);
    }
  }

  // 设置应用首次运行标志
  if (!store.has('appConfig.firstRun')) {
    store.set('appConfig.firstRun', true);
  }
};

export default store;