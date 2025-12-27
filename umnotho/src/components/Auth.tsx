// src/components/Auth.tsx
import React, { useState } from 'react';
import { useAuth } from './useAuth';
import logo from '../assets/Umnotho2.png';
import { useNavigate } from 'react-router-dom';

const Auth: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const { login, signUp, signInWithGoogle } = useAuth();

  const handleAuth = async () => {
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signUp(email, password, username);
      }
    } catch (error) {
      console.error("Authentication error", error);
      alert("Authentication failed. Please try again.");
    }
  };

  const handleGoogleAuth = async () => {
    try {
      await signInWithGoogle(); // This will handle both signup and login using Google
    } catch (error) {
      console.error("Google Authentication error", error);
      alert("Google Authentication failed. Please try again.");
    }
  };

  const handlePricing = () => navigate('/pricing');
  const handleLogoClick = () => navigate('/');

  return (
    <div>
      <nav className="navbar">
        <div className="nav-logo" onClick={handleLogoClick}>
          <img src={logo} alt="Umnotho Logo" style={{ cursor: 'pointer', height: '40px' }} />
        </div>
        <div className="nav-buttons">
          <button className="nav-button" onClick={handlePricing}>Pricing</button>
        </div>
      </nav>
      <div style={{ padding: '20px', textAlign: 'left' }}>
        <h2>{isLogin ? "Login" : "Sign Up"}</h2>
        
        {/* Username input only for Sign Up */}
        {!isLogin && (
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}
        
        {/* Email and Password fields */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        
        {/* Email/Password Auth Button */}
        <button onClick={handleAuth}>
          {isLogin ? "Login" : "Sign Up"}
        </button>

        {/* Google Auth Button */}
        <button 
          onClick={handleGoogleAuth} 
          style={{ marginTop: '10px', border: 'none', padding: '10px', cursor: 'pointer' }}
        >
          {isLogin ? "Sign in with Google" : "Sign up with Google"}
        </button>
        
        {/* Toggle Login/Signup */}
        <p onClick={() => setIsLogin(!isLogin)} style={{ cursor: 'pointer' }}>
          {isLogin ? "Create an account" : "Already have an account? Login"}
        </p>
      </div>
    </div>
  );
};

export default Auth;
