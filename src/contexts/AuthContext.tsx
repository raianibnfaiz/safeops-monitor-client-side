/**
 * AuthContext — global authentication state for the entire app.
 *
 * Responsibilities:
 *  - Restore a previous session from localStorage on first render
 *  - Expose login() / logout() actions to any component
 *  - Automatically log out the user when the JWT is about to expire
 *  - Keep isLoading = true until the session check finishes, so
 *    ProtectedRoute never flashes the login page on a valid session
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  useRef,
} from 'react';

import { authApi }                    from '@/api';
import { JWT_STORAGE_KEY,
         USER_PROFILE_KEY }           from '@/api/client';
import { secondsUntilTokenExpiry }    from '@/utils/jwt';
import type { AuthState, AuthUser, LoginCredentials } from '@/types';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login:  (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type AuthAction =
  | { type: 'SESSION_LOADING' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: AuthUser; token: string } }
  | { type: 'SESSION_CLEARED' };

const initialAuthState: AuthState = {
  user:            null,
  token:           null,
  isAuthenticated: false,
  isLoading:       true,   // start as loading until the stored token is checked
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SESSION_LOADING':
      return { ...state, isLoading: true };

    case 'LOGIN_SUCCESS':
      return {
        user:            action.payload.user,
        token:           action.payload.token,
        isAuthenticated: true,
        isLoading:       false,
      };

    case 'SESSION_CLEARED':
      return {
        user:            null,
        token:           null,
        isAuthenticated: false,
        isLoading:       false,
      };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, dispatch]    = useReducer(authReducer, initialAuthState);
  const tokenExpiryTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Schedule an automatic logout just before the JWT expires.
   * This ensures the UI reflects an expired session without waiting
   * for the next API call to return a 401.
   */
  const scheduleTokenExpiry = useCallback((authToken: string) => {
    if (tokenExpiryTimerRef.current) clearTimeout(tokenExpiryTimerRef.current);

    const secondsRemaining = secondsUntilTokenExpiry(authToken);
    if (secondsRemaining === Infinity || secondsRemaining <= 0) return;

    // Fire 15 seconds before expiry to give the UI time to update
    const millisecondsUntilLogout = Math.max(0, (secondsRemaining - 15) * 1000);

    tokenExpiryTimerRef.current = setTimeout(() => {
      localStorage.removeItem(JWT_STORAGE_KEY);
      localStorage.removeItem(USER_PROFILE_KEY);
      dispatch({ type: 'SESSION_CLEARED' });
    }, millisecondsUntilLogout);
  }, []);

  // ─── Restore session on first render ────────────────────────────────────────
  useEffect(() => {
    const savedToken = localStorage.getItem(JWT_STORAGE_KEY);

    if (!savedToken) {
      // No token stored — show the login page immediately
      dispatch({ type: 'SESSION_CLEARED' });
      return;
    }

    // Validate the stored token (checks expiry locally, no network call)
    authApi
      .getCurrentUser()
      .then((userProfile) => {
        dispatch({ type: 'LOGIN_SUCCESS', payload: { user: userProfile, token: savedToken } });
        scheduleTokenExpiry(savedToken);
      })
      .catch(() => {
        // Token missing, expired, or malformed — clear storage and show login
        localStorage.removeItem(JWT_STORAGE_KEY);
        localStorage.removeItem(USER_PROFILE_KEY);
        dispatch({ type: 'SESSION_CLEARED' });
      });

    return () => {
      if (tokenExpiryTimerRef.current) clearTimeout(tokenExpiryTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'SESSION_LOADING' });
    try {
      const { user: userProfile, token: authToken } = await authApi.login(credentials);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: userProfile, token: authToken } });
      scheduleTokenExpiry(authToken);
    } catch (loginError) {
      dispatch({ type: 'SESSION_CLEARED' });
      throw loginError; // re-throw so the Login page can display the error message
    }
  }, [scheduleTokenExpiry]);

  // ─── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (tokenExpiryTimerRef.current) clearTimeout(tokenExpiryTimerRef.current);
    await authApi.logout().catch(() => {}); // ignore backend errors
    dispatch({ type: 'SESSION_CLEARED' });
  }, []);

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return authContext;
}
