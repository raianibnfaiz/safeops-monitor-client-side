import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, TOKEN_STORAGE_KEY } from '@/config/env';

// ─── LocalStorage key names ───────────────────────────────────────────────────
export const JWT_STORAGE_KEY = TOKEN_STORAGE_KEY;
export const USER_PROFILE_KEY = 'safeops_user';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
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
