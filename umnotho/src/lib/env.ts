/**
 * Reads the Firebase web configuration from Vite environment variables.
 *
 * This module deliberately has no Firebase imports: it is safe to load before
 * the app and lets the UI explain a missing configuration instead of leaving a
 * blank page.
 */

export interface FirebaseEnv {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export const REQUIRED_FIREBASE_ENV = [
  { key: 'VITE_FIREBASE_API_KEY', label: 'Web API key' },
  { key: 'VITE_FIREBASE_AUTH_DOMAIN', label: 'Auth domain' },
  { key: 'VITE_FIREBASE_PROJECT_ID', label: 'Project ID' },
  { key: 'VITE_FIREBASE_STORAGE_BUCKET', label: 'Storage bucket' },
  { key: 'VITE_FIREBASE_MESSAGING_SENDER_ID', label: 'Messaging sender ID' },
  { key: 'VITE_FIREBASE_APP_ID', label: 'Web app ID' },
] as const;

const env = import.meta.env;
const envValues = env as Record<string, string | undefined>;

export const firebaseEnv: FirebaseEnv = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const missingFirebaseEnv = REQUIRED_FIREBASE_ENV.filter(({ key }) => {
  const value = envValues[key]?.trim();
  if (!value) return true;

  // Catch the values copied from .env.example without editing them.
  return (
    value.startsWith('your_') ||
    value === '123456789012' ||
    value.includes('abc123def456') ||
    value === 'your-project-id'
  );
}).map(({ key, label }) => ({ key, label }));

export const isFirebaseConfigured = missingFirebaseEnv.length === 0;
