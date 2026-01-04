import axios from 'axios';
import Store from 'electron-store';

const store = new Store();

const apiClient = axios.create({
});

apiClient.interceptors.request.use(
  (config) => {
    const credentials = store.get('currentUserCredentials');
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