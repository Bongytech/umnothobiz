import React from 'react';
import { useAuth } from './Auth';

const Profile: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="profile">
      {currentUser ? (
        <div>
          <h2>Welcome, {currentUser.displayName || 'User'}!</h2>
          <p>Email: {currentUser.email}</p>
          <p>Reputation Score: {/* Fetch and display user's reputation */}</p>
        </div>
      ) : (
        <p>Please log in to view your profile.</p>
      )}
    </div>
  );
};

export default Profile;
