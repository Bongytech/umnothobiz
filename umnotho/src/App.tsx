// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import Barter from './components/Barter';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from "firebase/auth";

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setIsAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  return (
    <Router> {/* Wrap the entire app in Router */}
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/barter" element={isAuthenticated ? <Barter /> : <Navigate to="/auth" />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/barter" : "/auth"} />} />
      </Routes>
    </Router>
  );
};

export default App;
