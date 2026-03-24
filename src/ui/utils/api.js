import axios from 'axios';

// 创建两个 axios 实例：一个用于普通请求，一个专门用于刷新 token（避免循环）
let apiClient;
let refreshTokenClient;

// 动态初始化 axios 实例
const initApiClient = async () => {
  const serverUrl = await window.electronAPI.getServerUrl();
  apiClient = axios.create({
    baseURL: `${serverUrl}/`,
  });
  refreshTokenClient = axios.create({
    baseURL: `${serverUrl}/`,
  });

  // 请求拦截器
  apiClient.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
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
};

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
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await refreshTokenClient.post('api/refresh-token', {
      refreshToken
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data;
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refreshToken', newRefreshToken);

    return accessToken;
  } catch (error) {
    // 刷新失败，清除本地存储并重定向到登录页
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    throw error;
  }
};

// 初始化 API 客户端
initApiClient();

export { apiClient, refreshTokenClient };