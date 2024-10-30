// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import Barter from './components/Barter'; // Import Barter component
import Pricing from './components/Pricing';  // Placeholder for Pricing component

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/barter" element={<Barter />} /> {/* Add Barter route */}
        <Route path="/pricing" element={<Pricing />} /> {/* Add Pricing route */}
        {/* Add other routes as needed */}
      </Routes>
    </Router>
  );
};

export default App;
