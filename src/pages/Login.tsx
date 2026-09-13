import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, UserPlus, LogIn } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, extractErrorMessage } from '@/api/auth';
import { useTheme } from '@/contexts/ThemeContext';

// Show demo credentials hint only when the app is in demo (mock) mode
const IS_DEMO_MODE = import.meta.env.VITE_MOCK_AUTH === 'true';

type FormMode = 'login' | 'register';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate  = useNavigate();
  const location  = useLocation();

  // Redirect back to the page the user was trying to reach before being sent to /login
  const redirectAfterLogin =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const [formMode, setFormMode]           = useState<FormMode>('login');
  const [name, setName]                   = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [errorMessage, setErrorMessage]   = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Already authenticated — go straight to the app
  useEffect(() => {
    if (isAuthenticated) navigate(redirectAfterLogin, { replace: true });
  }, [isAuthenticated, navigate, redirectAfterLogin]);

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const switchMode = (mode: FormMode) => {
    setFormMode(mode);
    clearMessages();
  };

  // ─── Login handler ───────────────────────────────────────────────────────────
  const handleLogin = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }
    setIsSubmitting(true);
    clearMessages();
    try {
      await login({ email, password });
      navigate(redirectAfterLogin, { replace: true });
    } catch (loginError) {
      setErrorMessage(extractErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Register handler ─────────────────────────────────────────────────────────
  const handleRegister = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    if (!name || !email || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    setIsSubmitting(true);
    clearMessages();
    try {
      const authResult = await authApi.register({ name, email, password });
      // Log in immediately after successful registration
      await login({ email, password });
      setSuccessMessage(`Welcome, ${authResult.user.name}! Redirecting…`);
      setTimeout(() => navigate(redirectAfterLogin, { replace: true }), 800);
    } catch (registerError) {
      setErrorMessage(extractErrorMessage(registerError));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Shared input class ───────────────────────────────────────────────────────
  const inputClass = (hasError: boolean) =>
    clsx(
      'block w-full px-3 py-2.5 rounded-lg border text-sm transition-colors',
      'bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
      'placeholder-gray-400 dark:placeholder-gray-500',
      'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
      hasError
        ? 'border-red-300 dark:border-red-600'
        : 'border-gray-300 dark:border-gray-600',
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      {/* Logo + title */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
          SafeOps Monitor
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Worker Safety Monitoring System
        </p>
      </div>

      {/* Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-8 shadow-sm rounded-2xl border border-gray-200 dark:border-gray-700">

          {/* Login / Register tab switcher */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 mb-6">
            <button
              onClick={() => switchMode('login')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors',
                formMode === 'login'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
            <button
              onClick={() => switchMode('register')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors',
                formMode === 'register'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              <UserPlus className="w-4 h-4" />
              Register
            </button>
          </div>

          {/* ─── Error message ─────────────────────────────────────────────── */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
            </div>
          )}

          {/* ─── Success message ───────────────────────────────────────────── */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
            </div>
          )}

          {/* ─── LOGIN FORM ───────────────────────────────────────────────── */}
          {formMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearMessages(); }}
                  placeholder="you@company.com"
                  className={inputClass(!!errorMessage)}
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearMessages(); }}
                    placeholder="••••••••"
                    className={inputClass(!!errorMessage)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign in'}
              </button>
            </form>
          )}

          {/* ─── REGISTER FORM ────────────────────────────────────────────── */}
          {formMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Full name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearMessages(); }}
                  placeholder="Jane Smith"
                  className={inputClass(!!errorMessage)}
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Email address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearMessages(); }}
                  placeholder="you@company.com"
                  className={inputClass(!!errorMessage)}
                />
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Password <span className="text-xs text-gray-400">(min. 6 characters)</span>
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearMessages(); }}
                    placeholder="••••••••"
                    className={inputClass(!!errorMessage)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
                  : 'Create account & sign in'}
              </button>
            </form>
          )}

          {/* ─── Demo credentials (only shown in demo/mock mode) ──────────── */}
          {IS_DEMO_MODE && (
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                Demo mode — use{' '}
                <button
                  type="button"
                  onClick={() => { setEmail('admin@safeops.com'); setPassword('password'); setFormMode('login'); clearMessages(); }}
                  className="font-mono text-primary-600 dark:text-primary-400 hover:underline"
                >
                  admin@safeops.com / password
                </button>
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
