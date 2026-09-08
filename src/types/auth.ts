export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'viewer';
  avatar?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  expiresIn: number;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
