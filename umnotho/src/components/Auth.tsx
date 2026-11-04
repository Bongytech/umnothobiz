import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'That email and password combination is not correct.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-not-found': 'No account exists for that email address.',
  'auth/wrong-password': 'That password is not correct.',
  'auth/email-already-in-use': 'An account with that email already exists. Try logging in.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
  'auth/unauthorized-domain': 'This domain is not authorised in Firebase Authentication.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
};

function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code && AUTH_ERRORS[code]) return AUTH_ERRORS[code];
  return 'Authentication failed. Please try again.';
}

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { login, signUp, signInWithGoogle, resetPassword } = useAuth();
  const from = (location.state as { from?: string } | null)?.from || '/barter';

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!isLogin && username.trim().length < 2) {
      setError('Choose a username with at least 2 characters.');
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await signUp(email.trim(), password, username.trim());
        setNotice('Account created. Check your inbox to verify your email before paying.');
      }
      navigate(from, { replace: true });
    } catch (authError) {
      console.error('Authentication error', authError);
      setError(authErrorMessage(authError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your email address first, then choose “Forgot password?”.');
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(email.trim());
      setNotice('Password reset email sent. Check your inbox.');
    } catch (authError) {
      console.error('Password reset error', authError);
      setError(authErrorMessage(authError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (authError) {
      console.error('Google authentication error', authError);
      setError(authErrorMessage(authError));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <nav className="h-20 flex justify-between items-center px-6 md:px-12 border-b border-white/5">
        <button
          type="button"
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/')}
          aria-label="Go to the Umnotho home page"
        >
          <span className="w-8 h-8 rounded-full bg-umnotho flex items-center justify-center text-dark-950 font-bold text-xl">
            U
          </span>
          <span className="text-xl font-display font-bold text-white tracking-tight">Umnotho</span>
        </button>
      </nav>

      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-dark-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-white mb-2">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h1>
            <p className="text-gray-400">
              {isLogin
                ? 'Enter your details to access your account.'
                : 'Join the Umnotho community today.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-sm"
            >
              {notice}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="Username"
                  value={username}
                  minLength={2}
                  maxLength={60}
                  onChange={(event) => setUsername(event.target.value)}
                  aria-label="Username"
                  className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-umnotho/50 focus:ring-1 focus:ring-umnotho/50 transition-all"
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-label="Email address"
                className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-umnotho/50 focus:ring-1 focus:ring-umnotho/50 transition-all"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                name="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder="Password"
                value={password}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                aria-label="Password"
                className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-umnotho/50 focus:ring-1 focus:ring-umnotho/50 transition-all"
                required
              />
            </div>

            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => void handleReset()}
                  disabled={isLoading}
                  className="text-xs text-gray-400 hover:text-umnotho transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-umnotho text-dark-950 font-semibold text-lg hover:bg-umnotho-hover transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? 'Processing…' : isLogin ? 'Log in' : 'Sign up'}
              {!isLoading && <ArrowRight className="w-5 h-5" />}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-sm text-gray-500">OR</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="w-full mt-6 py-3 rounded-xl bg-white text-dark-950 font-semibold text-base hover:bg-gray-100 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-xs text-gray-500">
            By continuing you agree to the{' '}
            <Link to="/legal/terms" className="text-gray-400 underline hover:text-white">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/legal/privacy" className="text-gray-400 underline hover:text-white">
              Privacy notice
            </Link>
            .
          </p>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin((value) => !value);
                setError('');
                setNotice('');
              }}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
