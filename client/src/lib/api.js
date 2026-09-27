import axios from 'axios';
import { toast } from 'sonner';
import i18n from '../i18n';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const TOKEN_KEY = 'sf_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 90_000 });

/** Lets the API skip the realtime echo of our own changes. */
export function setSocketId(id) {
  if (id) api.defaults.headers.common['X-Socket-Id'] = id;
  else delete api.defaults.headers.common['X-Socket-Id'];
}

// Free Render instances sleep when idle; tell the user if the first request is slow
let pending = 0;
let wakeTimer = null;
const WAKE_TOAST_ID = 'server-waking';

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  pending += 1;
  if (!wakeTimer) {
    wakeTimer = setTimeout(() => toast.loading(i18n.t('common.serverWaking'), { id: WAKE_TOAST_ID }), 5000);
  }
  return config;
});

function settle() {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    clearTimeout(wakeTimer);
    wakeTimer = null;
    toast.dismiss(WAKE_TOAST_ID);
  }
}

api.interceptors.response.use(
  (response) => {
    settle();
    return response;
  },
  (error) => {
    settle();
    if (error.response?.status === 401 && tokenStore.get()) {
      window.dispatchEvent(new Event('sf:unauthorized'));
    }
    return Promise.reject(error);
  }
);

/** Translate an API error into a user-facing message. */
export function errorMessage(error) {
  const data = error?.response?.data;
  if (!error?.response) return i18n.t('errors.network');
  if (data?.code && i18n.exists(data.code)) return i18n.t(data.code);
  return data?.message || i18n.t('errors.server');
}

export function toastError(error) {
  toast.error(errorMessage(error));
}
