import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({ baseURL: '/api' });

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url?.includes('/auth/login');
    const isApprovalLink = /^\/?purok-approve\//.test(err.config?.url || '');
    if ((err.response?.status === 401 || err.response?.data?.code === 'ACCOUNT_DISABLED') && !isLoginRequest && !isApprovalLink && useAuthStore.getState().token) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
