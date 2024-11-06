// src/components/useAuth.tsx
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect, getRedirectResult, signOut } from "firebase/auth";
import { useState, useEffect } from 'react';
import { googleProvider, db } from "../firebaseConfig";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';

const auth = getAuth();

interface AuthContext {
  user: any;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;  // New function
  logout: () => Promise<void>;
}

export const useAuth = (): AuthContext => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => setUser(user));
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
  try {
    await signInWithRedirect(auth, googleProvider); // Replace signInWithPopup with signInWithRedirect
  } catch (error) {
    console.error("Google Sign-In error:", error);
  }
};

useEffect(() => {
  const handleRedirectResult = async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        const user = result.user;

        // Optional: Initialize user in Firestore if needed
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, { displayName: user.displayName, email: user.email }, { merge: true });

        navigate("/barter");
      }
    } catch (error) {
      console.error("Error handling Google redirect result:", error);
    }
  };

  handleRedirectResult();
}, []);


  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    navigate("/barter");
  };

  const signUp = async (email: string, password: string, username: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { displayName: username, email });
    navigate("/barter");
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    navigate("/auth");
  };

  return { user, login, signUp, signInWithGoogle, logout };
};
