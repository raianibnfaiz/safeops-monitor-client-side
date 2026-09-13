/**
 * Runtime config — all server URLs come from .env.
 * Do not hardcode API or Socket hosts anywhere else.
 */

function requiredEnv(name: 'VITE_API_BASE_URL' | 'VITE_SOCKET_URL'): string {
  const value = import.meta.env[name];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().replace(/\/$/, '');
  }
  throw new Error(
    `${name} is not set. Add it to your .env file (see .env.example).`,
  );
}

export const API_BASE_URL = requiredEnv('VITE_API_BASE_URL');
export const SOCKET_SERVER_URL = requiredEnv('VITE_SOCKET_URL');
export const TOKEN_STORAGE_KEY = import.meta.env.VITE_TOKEN_KEY || 'safeops_token';
export const IS_DEMO_MODE = import.meta.env.VITE_MOCK_AUTH === 'true';
