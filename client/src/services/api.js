import axios from 'axios';
import useAuthStore from '../store/authStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://irequestd.onrender.com/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLoginRequest) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

/* Use fetch for multipart/form-data — Axios 1.x strips the boundary from
   Content-Type when set manually, causing multer to fail. fetch lets the
   browser add the correct boundary automatically. */
export async function multipartPost(path, formData) {
  const token = useAuthStore.getState().token;
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw { response: { data } };
  return { data };
}

export default api;
