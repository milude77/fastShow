import axios from 'axios';
import { userCredentialsManager } from './store.js';

const apiClient = axios.create({
});

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

export default apiClient;