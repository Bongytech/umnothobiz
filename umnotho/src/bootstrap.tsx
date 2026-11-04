import { StrictMode } from 'react';
import type { Root } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import AppErrorBoundary from './components/AppErrorBoundary';

/**
 * Loaded only after the Firebase environment has been validated, so a missing
 * configuration can be explained by the startup screen instead of throwing
 * during a static import.
 */
export function bootstrap(root: Root) {
  root.render(
    <StrictMode>
      <AppErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppErrorBoundary>
    </StrictMode>,
  );
}
