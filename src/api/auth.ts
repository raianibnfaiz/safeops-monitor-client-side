/**
 * Auth API service
 *
 * Implements the three steps of the JWT authentication flow:
 *   1. login  → POST /api/auth/login  → store token + user profile
 *   2. getCurrentUser → read from localStorage (no extra network call)
 *   3. logout → POST /api/auth/logout → clear local storage
 *
 * All protected routes on the backend already validate the JWT that
 * the Axios client attaches via the Authorization header.
 */

import { apiClient, JWT_STORAGE_KEY, USER_PROFILE_KEY } from './client';
import { isTokenExpired, decodeJwtPayload } from '@/utils/jwt';
import type { LoginCredentials, RegisterCredentials, AuthResponse, AuthUser } from '@/types';

// ─── Demo mode ────────────────────────────────────────────────────────────────
// Set VITE_MOCK_AUTH=true in .env to bypass the real backend during UI testing.
const IS_DEMO_MODE = import.meta.env.VITE_MOCK_AUTH === 'true';

const DEMO_USER: AuthUser = {
  id:    'demo-001',
  name:  'Alex Johnson',
  email: 'admin@safeops.com',
  role:  'admin',
};
const DEMO_TOKEN = 'demo-jwt-token-not-for-production';

async function demoLogin(credentials: LoginCredentials): Promise<AuthResponse> {
  // Simulate a realistic network delay
  await new Promise((resolve) => setTimeout(resolve, 700));

  const isValidDemoCredentials =
    credentials.email    === 'admin@safeops.com' &&
    credentials.password === 'password';

  if (!isValidDemoCredentials) {
    const loginError = new Error('Invalid credentials. Use admin@safeops.com / password');
    Object.assign(loginError, {
      response: {
        status: 401,
        data: { message: 'Invalid credentials. Use admin@safeops.com / password' },
      },
    });
    throw loginError;
  }

  localStorage.setItem(JWT_STORAGE_KEY,  DEMO_TOKEN);
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(DEMO_USER));
  return { token: DEMO_TOKEN, user: DEMO_USER, expiresIn: 86_400 };
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract a human-readable error message from any Axios error.
 * Reads the `message` field from the backend's JSON error body.
 */
export function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'An unexpected error occurred.';
  }

  const axiosError   = error as Record<string, unknown>;
  const httpResponse = axiosError.response as Record<string, unknown> | undefined;

  if (!httpResponse) {
    // No HTTP response — likely a network connectivity problem
    const errorMessage = (axiosError.message as string | undefined) ?? '';
    const isConnectionRefused =
      errorMessage.includes('Network Error') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ERR_CONNECTION_REFUSED');

    if (isConnectionRefused) {
      return 'Cannot reach the server. Make sure the backend is running.';
    }
    return errorMessage || 'Network error. Please try again.';
  }

  // Backend returns { success: false, message: "..." }
  const responseBody = httpResponse.data as Record<string, unknown> | undefined;
  return (
    (responseBody?.message as string | undefined) ??
    (responseBody?.error   as string | undefined) ??
    `Server error (${httpResponse.status}).`
  );
}

/**
 * Parse the raw login response from the backend.
 *
 * Backend sends:     { success: true, token: "eyJ...", user: { _id, name, email, role } }
 * AuthResponse type: { token, user, expiresIn }
 */
function parseLoginResponse(responsePayload: unknown): AuthResponse {
  const responseBody = responsePayload as Record<string, unknown>;

  // Some backends wrap the payload in a `data` envelope
  const loginPayload =
    (responseBody.data as Record<string, unknown> | undefined) ?? responseBody;

  const authToken =
    (loginPayload.token       as string | undefined) ??
    (loginPayload.accessToken as string | undefined) ??
    '';

  const userFields = (loginPayload.user as Record<string, unknown> | undefined) ?? {};

  const userProfile: AuthUser = {
    id:     String(userFields._id   ?? userFields.id    ?? ''),
    name:   String(userFields.name  ?? ''),
    email:  String(userFields.email ?? ''),
    role:  ((userFields.role as string | undefined) ?? 'viewer') as AuthUser['role'],
    avatar:  userFields.avatar as string | undefined,
  };

  return {
    token:     authToken,
    user:      userProfile,
    expiresIn: (loginPayload.expiresIn as number | undefined) ?? 86_400,
  };
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {

  /**
   * STEP 0 — Register (first-time setup)
   *
   * Creates a new user account, then immediately logs in so the user
   * lands on the dashboard without a second form submission.
   */
  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    const { data: registerResponse } = await apiClient.post('/auth/register', credentials);
    const authResult = parseLoginResponse(registerResponse);

    if (!authResult.token) {
      throw new Error('Registration succeeded but the server returned no token.');
    }

    localStorage.setItem(JWT_STORAGE_KEY,  authResult.token);
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(authResult.user));
    return authResult;
  },

  /**
   * STEP 1 — Login
   *
   * Sends credentials to the backend. On success, stores the returned JWT
   * and user profile in localStorage so they survive page refreshes.
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    if (IS_DEMO_MODE) return demoLogin(credentials);

    const { data: loginResponse } = await apiClient.post('/auth/login', credentials);
    const authResult = parseLoginResponse(loginResponse);

    if (!authResult.token) {
      throw new Error('Login succeeded but the server returned no token.');
    }

    // Persist the JWT and user profile for session restoration on page reload
    localStorage.setItem(JWT_STORAGE_KEY,  authResult.token);
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(authResult.user));

    return authResult;
  },

  /**
   * STEP 2 — Restore session (called on every page load)
   *
   * Reads the stored JWT and validates its expiry locally — no network call.
   * Returns the cached user profile if the token is still valid.
   * Throws with status 401 if there is no token, the token is expired,
   * or the token payload cannot be decoded; AuthContext will redirect to /login.
   */
  getCurrentUser: async (): Promise<AuthUser> => {
    if (IS_DEMO_MODE) {
      const savedToken = localStorage.getItem(JWT_STORAGE_KEY);
      if (savedToken === DEMO_TOKEN) return DEMO_USER;
      throw Object.assign(new Error('No active session'), { response: { status: 401 } });
    }

    const savedToken = localStorage.getItem(JWT_STORAGE_KEY);

    if (!savedToken) {
      throw Object.assign(new Error('No token found — please log in'), { response: { status: 401 } });
    }

    if (isTokenExpired(savedToken)) {
      localStorage.removeItem(JWT_STORAGE_KEY);
      localStorage.removeItem(USER_PROFILE_KEY);
      throw Object.assign(new Error('Session expired — please log in again'), { response: { status: 401 } });
    }

    // Token is valid — return the cached user profile (avoids an extra network request)
    const cachedUserJson = localStorage.getItem(USER_PROFILE_KEY);
    if (cachedUserJson) {
      try {
        return JSON.parse(cachedUserJson) as AuthUser;
      } catch {
        // Cache was corrupted — fall through and rebuild from JWT payload
      }
    }

    // Edge case: token present but user cache missing — reconstruct from JWT payload
    const jwtPayload = decodeJwtPayload(savedToken);
    if (jwtPayload) {
      const userProfile: AuthUser = {
        id:    String(jwtPayload.sub ?? jwtPayload.id ?? jwtPayload.userId ?? ''),
        name:  String(jwtPayload.name  ?? jwtPayload.email ?? 'User'),
        email: String(jwtPayload.email ?? ''),
        role: ((jwtPayload.role as string | undefined) ?? 'viewer') as AuthUser['role'],
      };
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(userProfile));
      return userProfile;
    }

    // Token exists but cannot be decoded — treat as invalid
    localStorage.removeItem(JWT_STORAGE_KEY);
    throw Object.assign(new Error('Token is invalid — please log in again'), { response: { status: 401 } });
  },

  /**
   * STEP 3 — Logout
   *
   * Notifies the backend (so it can invalidate the token server-side),
   * then clears all auth data from localStorage regardless of the result.
   */
  logout: async (): Promise<void> => {
    if (IS_DEMO_MODE) {
      localStorage.removeItem(JWT_STORAGE_KEY);
      localStorage.removeItem(USER_PROFILE_KEY);
      return;
    }

    try {
      // Best-effort call — the backend may blacklist the token server-side
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore backend errors; local session must be cleared either way
    } finally {
      localStorage.removeItem(JWT_STORAGE_KEY);
      localStorage.removeItem(USER_PROFILE_KEY);
    }
  },
};
