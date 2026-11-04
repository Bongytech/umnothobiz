import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { displayNameFor } from '../lib/user';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Creates the profile document the first time a user signs in. Existing
 * profiles are left untouched so a login can never reset reputation or role.
 */
async function ensureUserProfile(user: User): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) return;

  await setDoc(userRef, {
    displayName: displayNameFor(user),
    email: user.email || '',
    ratings: {},
    createdAt: serverTimestamp(),
  });
}

function isPopupBlocked(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/operation-not-supported-in-this-environment'
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return;

      setUser(nextUser);
      setLoading(false);

      if (nextUser) {
        void ensureUserProfile(nextUser).catch((error: unknown) => {
          // A missing/misconfigured Firestore database must not block sign-in.
          console.error('Could not create the user profile:', error);
        });
      }
    });

    // Completes a Google redirect sign-in when the browser returns to the app.
    void getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          return ensureUserProfile(result.user);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        console.error('Google redirect sign-in failed:', error);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const displayName = username.trim().slice(0, 60);
    await updateProfile(credential.user, { displayName });

    // The auth listener may already have created the profile with the email
    // prefix as a fallback, so create it if needed and then set the chosen
    // username. Both operations are allowed by the users rules.
    await ensureUserProfile(credential.user);
    await updateDoc(doc(db, 'users', credential.user.uid), { displayName });

    try {
      await sendEmailVerification(credential.user);
    } catch (error) {
      // Signup must still succeed if the verification email cannot be sent.
      console.error('Could not send the verification email:', error);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (isPopupBlocked(error)) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, signUp, signInWithGoogle, logout, resetPassword }),
    [user, loading, login, signUp, signInWithGoogle, logout, resetPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return context;
}
