import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// ─── LocalStorage key names ───────────────────────────────────────────────────
// These are the keys used to persist auth data between page loads.
// Other modules import these constants so the key strings stay in one place.
export const JWT_STORAGE_KEY  = import.meta.env.VITE_TOKEN_KEY || 'safeops_token';
export const USER_PROFILE_KEY = 'safeops_user';

// ─── Axios instance ───────────────────────────────────────────────────────────
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: attach JWT on every outgoing request ────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const savedToken = localStorage.getItem(JWT_STORAGE_KEY);
    if (savedToken && config.headers) {
      config.headers.Authorization = `Bearer ${savedToken}`;
    }
    return config;
  },
  (requestError) => Promise.reject(requestError),
);

// ─── Response interceptor: handle expired / invalid JWT ──────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const isAuthRoute = error.config?.url?.includes('/auth/');
    const isUnauthorized = error.response?.status === 401;

    // Clear local session and redirect to login on 401,
    // but NOT during the login request itself (that would hide the error message).
    if (isUnauthorized && !isAuthRoute) {
      localStorage.removeItem(JWT_STORAGE_KEY);
      localStorage.removeItem(USER_PROFILE_KEY);
      window.location.href = '/login';
    }

    return Promise.reject(error);
  },
);
