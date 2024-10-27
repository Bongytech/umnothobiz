import React from 'react';
import { Link } from 'react-router-dom';

const Navbar: React.FC = () => (
  <nav>
    <Link to="/">Profile</Link>
    <Link to="/barter">Barter</Link>
    <Link to="/crowdfunding">Crowdfunding</Link>
    <Link to="/investments">Investments</Link>
  </nav>
);

export default Navbar;
