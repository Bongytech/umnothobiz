import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { motion } from 'motion/react';
import { ArrowRight, Mail, Lock, User } from 'lucide-react';

const Auth: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  const navigate = useNavigate();
  const { login, signUp, signInWithGoogle } = useAuth();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signUp(email, password, username);
      }
    } catch (err: any) {
      console.error("Authentication error", err);
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google Authentication error", err);
      setError(err.message || "Google Authentication failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <nav className="h-20 flex justify-between items-center px-6 md:px-12 border-b border-white/5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-full bg-umnotho flex items-center justify-center text-dark-950 font-bold text-xl">U</div>
          <span className="text-xl font-display font-bold text-white tracking-tight">Umnotho</span>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-dark-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-display font-bold text-white mb-2">
              {isLogin ? "Welcome back" : "Create an account"}
            </h2>
            <p className="text-gray-400">
              {isLogin ? "Enter your details to access your account." : "Join the Umnotho community today."}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-umnotho/50 focus:ring-1 focus:ring-umnotho/50 transition-all"
                  required
                />
              </div>
            )}
            
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-umnotho/50 focus:ring-1 focus:ring-umnotho/50 transition-all"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-umnotho/50 focus:ring-1 focus:ring-umnotho/50 transition-all"
                required
              />
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-umnotho text-dark-950 font-semibold text-lg hover:bg-umnotho-hover transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? "Processing..." : (isLogin ? "Log in" : "Sign up")}
              {!isLoading && <ArrowRight className="w-5 h-5" />}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-sm text-gray-500">OR</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          <button 
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="w-full mt-6 py-3 rounded-xl bg-white text-dark-950 font-semibold text-base hover:bg-gray-100 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Auth;
