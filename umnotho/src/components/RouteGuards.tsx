import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center gap-4 text-umnotho">
      <div className="w-10 h-10 rounded-full border-2 border-umnotho/30 border-t-umnotho animate-spin" />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader label="Checking your session…" />;
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <FullPageLoader label="Checking your session…" />;
  if (user) return <Navigate to="/barter" replace />;

  return <>{children}</>;
}
