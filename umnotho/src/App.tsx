import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import Barter from './components/Barter';
import Pricing from './components/Pricing';
import MyBids from './components/MyBids';
import Profile from './components/Profile';
import LegalPage from './components/LegalPage';
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/auth"
          element={
            <PublicOnlyRoute>
              <Auth />
            </PublicOnlyRoute>
          }
        />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/legal/terms" element={<LegalPage kind="terms" />} />
        <Route path="/legal/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/legal/refunds" element={<LegalPage kind="refunds" />} />
        <Route
          path="/barter"
          element={
            <ProtectedRoute>
              <Barter />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-bids"
          element={
            <ProtectedRoute>
              <MyBids />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
