// src/components/useAuth.tsx
import { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface AuthContext {
  user: any;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = (): AuthContext => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);

        // Check if user document exists in Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnapshot = await getDoc(userRef);

        // If the document doesn't exist, create it with default data
        if (!userSnapshot.exists()) {
          await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName || "",
            reputation: 5, 
			subscriptionType:"none",
            createdAt: new Date(),
          });
        }
      } else {
        setUser(null);
      }
    });

    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;

    // After signup, create a new user document in Firestore
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      email,
      displayName: username,
      reputation: 5,
	  subscriptionType:"none", // Default reputation value for new users
      createdAt: new Date(),
    });

    navigate("/barter");
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    navigate("/barter");
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    navigate("/auth");
  };

  return { user, login, signUp, logout };
};
