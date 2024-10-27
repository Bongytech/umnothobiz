// src/components/Auth.tsx
import React, { useState } from 'react';
import { auth, db } from '../firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';

const Auth: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  // Function to initialize user profile with default reputation
  const initializeUserProfile = async (userId: string) => {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      reputation: 5,  // Default starting reputation
      displayName: email.split('@')[0],  // Optional: use part of the email as display name
    });
  };

  const handleAuth = async () => {
    try {
      if (isLogin) {
        // Log in the user
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Sign up the user and initialize profile in Firestore
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userId = userCredential.user.uid;
        await initializeUserProfile(userId);  // Set default reputation for new users
      }
      // Navigate to barter page after successful login/signup
      navigate("/barter");
    } catch (error) {
      console.error("Authentication error", error);
      alert("Authentication failed. Please try again.");
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>{isLogin ? "Login" : "Sign Up"}</h2>
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
      <button onClick={handleAuth}>
        {isLogin ? "Login" : "Sign Up"}
      </button>
      <p onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "Create an account" : "Already have an account? Login"}
      </p>
    </div>
  );
};

export default Auth;
