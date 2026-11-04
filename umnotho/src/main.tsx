import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import StartupError from './components/StartupError';
import { isFirebaseConfigured, missingFirebaseEnv } from './lib/env';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('The #root element is missing from index.html.');
}

const root = createRoot(container);

if (!isFirebaseConfigured) {
  root.render(
    <StrictMode>
      <StartupError
        title="Firebase is not configured"
        message="Umnotho needs a Firebase web app configuration before it can start. Follow the steps below, then restart the dev server."
        missing={missingFirebaseEnv}
      />
    </StrictMode>,
  );
} else {
  // Keep the Firebase imports out of the initial module graph so a missing
  // configuration renders the screen above instead of failing with a blank page.
  void import('./bootstrap')
    .then(({ bootstrap }) => bootstrap(root))
    .catch((error: unknown) => {
      console.error('Umnotho failed to start:', error);
      root.render(
        <StrictMode>
          <StartupError
            title="The app failed to start"
            message="The Firebase modules could not be loaded. The error is shown below."
            details={[error instanceof Error ? error.message : String(error)]}
          />
        </StrictMode>,
      );
    });
}
