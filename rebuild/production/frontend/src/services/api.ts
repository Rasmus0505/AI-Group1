import axios from 'axios';
import { serverConfigService } from './serverConfig';

// 使用动态服务器配置
const getApiBaseUrl = () => serverConfigService.getApiBaseUrl();

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 120000, // 增加到120秒，适应AI API调用
  headers: {
    'Content-Type': 'application/json',
  },
});

// 监听服务器配置变化，动态更新 baseURL
serverConfigService.subscribe((config) => {
  apiClient.defaults.baseURL = config.apiBaseUrl;
});

// Request interceptor - Add token
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 每次请求时确保使用最新的 baseURL
    config.baseURL = getApiBaseUrl();
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
