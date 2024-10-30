// src/components/Profile.tsx
import React from 'react';
import { useAuth } from './useAuth';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: '20px' }}>
      <h2>User Profile</h2>
      {user ? (
        <>
          <p>Email: {user.email}</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <p>No user information available.</p>
      )}
    </div>
  );
};

export default Profile;

