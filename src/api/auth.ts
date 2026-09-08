import { apiClient, TOKEN_KEY } from './client';
import type { LoginCredentials, AuthResponse, AuthUser } from '@/types';

// ---------------------------------------------------------------------------
// MOCK MODE — set VITE_MOCK_AUTH=true in .env to bypass the real backend.
// ---------------------------------------------------------------------------
const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
const USER_KEY = 'safeops_user';

const MOCK_USER: AuthUser = {
  id: 'usr_001',
  name: 'Alex Johnson',
  email: 'admin@safeops.com',
  role: 'admin',
};
const MOCK_TOKEN = 'mock-jwt-token-safeops-demo';

async function mockLogin(credentials: LoginCredentials): Promise<AuthResponse> {
  await new Promise((r) => setTimeout(r, 800));
  if (credentials.email === 'admin@safeops.com' && credentials.password === 'password') {
    localStorage.setItem(TOKEN_KEY, MOCK_TOKEN);
    localStorage.setItem(USER_KEY, JSON.stringify(MOCK_USER));
    return { token: MOCK_TOKEN, user: MOCK_USER, expiresIn: 86400 };
  }
  const err = new Error('Invalid credentials. Use admin@safeops.com / password');
  Object.assign(err, { response: { status: 401, data: { message: 'Invalid credentials. Use admin@safeops.com / password' } } });
  throw err;
}

async function mockMe(): Promise<AuthUser> {
  await new Promise((r) => setTimeout(r, 100));
  const token = localStorage.getItem(TOKEN_KEY);
  if (token === MOCK_TOKEN) return MOCK_USER;
  const err = new Error('Unauthorized');
  Object.assign(err, { response: { status: 401 } });
  throw err;
}
// ---------------------------------------------------------------------------

// Extract human-readable message from any Axios error response shape
export function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return 'An unexpected error occurred.';
  const err = error as Record<string, unknown>;
  const response = err.response as Record<string, unknown> | undefined;
  if (!response) {
    // Network error — no connection to server
    const msg = (err.message as string | undefined) ?? '';
    if (msg.includes('Network Error') || msg.includes('ECONNREFUSED')) {
      return 'Cannot reach the server. Make sure the backend is running on http://localhost:5000.';
    }
    return msg || 'Network error. Please try again.';
  }
  const data = response.data as Record<string, unknown> | undefined;
  // Backend sends { success: false, message: "..." }
  return (
    (data?.message as string | undefined) ??
    (data?.error as string | undefined) ??
    `Server error (${response.status}).`
  );
}

// ---------------------------------------------------------------------------
// Normalise login response — backend sends: { success, token, user }
// Our AuthResponse type expects:          { token, user, expiresIn }
// ---------------------------------------------------------------------------
function normaliseLoginResponse(raw: unknown): AuthResponse {
  const r = raw as Record<string, unknown>;
  // Unwrap { data: {...} } if present
  const payload = (r.data as Record<string, unknown> | undefined) ?? r;
  const token = (payload.token as string | undefined) ?? (payload.accessToken as string | undefined) ?? '';
  const rawUser = (payload.user as Record<string, unknown> | undefined) ?? {};
  const user: AuthUser = {
    id: (rawUser._id ?? rawUser.id ?? '') as string,
    name: (rawUser.name ?? '') as string,
    email: (rawUser.email ?? '') as string,
    role: ((rawUser.role as string | undefined) ?? 'viewer') as AuthUser['role'],
    avatar: rawUser.avatar as string | undefined,
  };
  return { token, user, expiresIn: (payload.expiresIn as number | undefined) ?? 86400 };
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    if (MOCK_AUTH) return mockLogin(credentials);
    const { data } = await apiClient.post('/auth/login', credentials);
    const result = normaliseLoginResponse(data);
    localStorage.setItem(TOKEN_KEY, result.token);
    // Cache user so we don't need a /me endpoint
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    return result;
  },

  logout: async (): Promise<void> => {
    if (MOCK_AUTH) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return;
    }
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },

  // Backend has no /me endpoint — return cached user from localStorage.
  // If not found, the AuthContext will treat the session as expired.
  me: async (): Promise<AuthUser> => {
    if (MOCK_AUTH) return mockMe();
    const cached = localStorage.getItem(USER_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as AuthUser;
      } catch { /* fall through */ }
    }
    // Fallback: try /me if the backend supports it
    try {
      const { data } = await apiClient.get('/auth/me');
      const r = data as Record<string, unknown>;
      const raw = (r.data ?? r.user ?? r) as Record<string, unknown>;
      return {
        id: (raw._id ?? raw.id ?? '') as string,
        name: (raw.name ?? '') as string,
        email: (raw.email ?? '') as string,
        role: ((raw.role as string | undefined) ?? 'viewer') as AuthUser['role'],
      };
    } catch {
      // No token or /me not found — force re-login
      localStorage.removeItem(TOKEN_KEY);
      throw Object.assign(new Error('Session expired'), { response: { status: 401 } });
    }
  },
};
