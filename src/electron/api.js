import axios from 'axios';
import { userCredentialsManager } from './store.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { BrowserWindow } from 'electron';

// ESM-compliant __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- Socket.IO Main Process Setup ---


const configPath = path.join(__dirname, '..', '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));


const isDev = config.NODE_ENV === "development"


// 修复：SOCKET_SERVER_URL 应该只包含主机和端口，不包含协议
const SOCKET_SERVER_URL = (isDev ? config.DEV_SERVER_URL : config.SOCKET_SERVER_URL) || 'http://localhost:3001';


// 创建两个 axios 实例：一个用于普通请求，一个专门用于刷新 token
const apiClient = axios.create({
  // 修复：正确构建 baseURL，不重复添加 http://
  baseURL: `${SOCKET_SERVER_URL}/`,
  timeout: 5000,
});
const refreshTokenClient = axios.create({
  baseURL: `${SOCKET_SERVER_URL}/`,
  timeout: 5000,
});

// 请求队列，用于存储因 token 过期而被挂起的请求
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 刷新 token 的函数
const refreshAccessToken = async () => {
  const credentials = userCredentialsManager.getCurrentCredentials();
  const refreshToken = credentials?.refreshToken;

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await refreshTokenClient.post('api/refresh-token', {
      refreshToken
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data;
    userCredentialsManager.updateCurrentCredentials({
      ...credentials,
      token: accessToken,
      refreshToken: newRefreshToken
    });

    return accessToken;
  } catch (error) {
    // 刷新失败，清除凭证并触发重新登录
    userCredentialsManager.clearCurrentCredentials();
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('token-expired');
    });
    throw error;
  }
};

apiClient.interceptors.request.use(
  (config) => {
    const credentials = userCredentialsManager.getCurrentCredentials();
    const token = credentials?.token;
    if (token) {
      config.headers['authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理 token 过期
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 如果已经在刷新 token，将请求加入队列
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['authorization'] = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        processQueue(null, newToken);

        originalRequest.headers['authorization'] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;