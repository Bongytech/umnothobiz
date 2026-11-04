import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { firebaseEnv, missingFirebaseEnv } from './env';

if (missingFirebaseEnv.length > 0) {
  // The startup screen catches this before app code is imported. Keep this
  // guard for any other entry point that imports Firebase directly.
  throw new Error(
    `Firebase is not configured. Missing: ${missingFirebaseEnv
      .map(({ key }) => key)
      .join(', ')}. Copy .env.example to .env.local and fill in the values.`,
  );
}

export const app = initializeApp(firebaseEnv);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: 'select_account' });

// The emulators are opt-in so production builds never point at localhost.
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
