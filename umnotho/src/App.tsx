/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import Barter from './components/Barter'; 
import Pricing from './components/Pricing'; 
import MyBids from './components/MyBids';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/barter" element={<Barter />} /> 
        <Route path="/pricing" element={<Pricing />} /> 
        <Route path="/my-bids" element={<MyBids />} /> 
      </Routes>
    </Router>
  );
}
