import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { User } from 'firebase/auth';

interface AuthContextProps {
  currentUser: User | null;
}

const AuthContext = createContext<AuthContextProps>({ currentUser: null });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user: any) => setCurrentUser(user));
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
