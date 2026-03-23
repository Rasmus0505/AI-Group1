import axios from 'axios';
import { serverConfigService } from './serverConfig';
import { clearAuthSession, getStoredToken, isTokenExpired } from '../utils/authSession';

const getApiBaseUrl = () => serverConfigService.getApiBaseUrl();

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

serverConfigService.subscribe(config => {
  apiClient.defaults.baseURL = config.apiBaseUrl;
});

apiClient.interceptors.request.use(
  config => {
    const token = getStoredToken();
    if (token) {
      if (isTokenExpired(token)) {
        clearAuthSession();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(new Error('Authentication token expired'));
      }
      config.headers.Authorization = `Bearer ${token}`;
    }

    config.baseURL = getApiBaseUrl();
    return config;
  },
  error => Promise.reject(error)
);

apiClient.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      clearAuthSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
