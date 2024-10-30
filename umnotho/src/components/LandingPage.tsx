// src/components/LandingPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // Import the global CSS file
import logo from '../assets/Umnotho2.png';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  // Navigation handlers
  const handleLogin = () => navigate('/auth');
  const handlePricing = () => navigate('/pricing');
  const handleLogoClick = () => navigate('/');
 // const handleSignUp = () => navigate('/signup');

  return (
    <div className="container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo" onClick={handleLogoClick}>
          <img src={logo} alt="Umnotho Logo" style={{ cursor: 'pointer', height: '40px' }} />
        </div>
        <div className="nav-buttons">
          <button className="nav-button" onClick={handleLogin}>Login</button>
          <button className="nav-button" onClick={handlePricing}>Pricing</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <h3 className="slogan">No money? No problem. Get what you need, give what you can.</h3>
        <p className="subheadline">
         Join a community-powered marketplace where value is created through exchange, not currency.
        </p>
      </section>

      {/* About Section */}
      <section className="section">
        <h2 className="section-title">About Umnotho</h2>
        <p className="section-text">
          Umnotho is a <strong>barter exchange platform</strong> designed to empower communities through cashless trading. 
          Trade goods, skills, and services with security and trust, all without money changing hands.
        </p>
      </section>

      {/* How It Works Section */}
      <section className="section">
        <h2 className="section-title">How It Works</h2>
        <ul className="list">
          <li className="list-item"><strong>Sign Up:</strong> Create a secure account and join the Umnotho community.</li>
          <li className="list-item"><strong>List Items:</strong> Post items or services for exchange with ease.</li>
          <li className="list-item"><strong>Place Bids:</strong> Interested in an item? Start a trade with a bid.</li>
          <li className="list-item"><strong>Complete Exchange:</strong> Confirm transactions and build your reputation.</li>
        </ul>
      </section>

      {/* Core Features Section */}
      <section className="section">
        <h2 className="section-title">Security and Trust</h2>
        <ul className="list">
          <li className="list-item"><strong>Verified Accounts:</strong> For trust within the community.</li>
          <li className="list-item"><strong>Reputation System:</strong> Rate trades to build trust.</li>
          <li className="list-item"><strong>Secure Messaging:</strong> Private chat to negotiate trades.</li>
        </ul>
      </section>

      {/* Call to Action */}
      <section className="cta-section">
        <h2 className="section-title">Start Trading Today</h2>
        <p className="section-text">
          Join Umnotho and experience a new way to trade. Sign up and start bartering today!
        </p>
        <button className="button-primary" onClick={handleLogin}>
        Join the community
        </button>
      </section>
    </div>
  );
};

export default LandingPage;
