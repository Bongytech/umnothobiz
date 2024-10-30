// src/components/Transaction.tsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from './useAuth';

type Transaction = {
  id: string;
  itemId: string;
  user1Id: string;
  user2Id: string;
  status: 'pending' | 'confirmed' | 'completed';
  user1Rating?: number;
  user2Rating?: number;
};

const Transaction: React.FC<{ transactionId: string }> = ({ transactionId }) => {
  const { user } = useAuth();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [rating, setRating] = useState<number>(0);

  // Fetch transaction details
  useEffect(() => {
    const fetchTransaction = async () => {
      const transactionRef = doc(db, 'transactions', transactionId);
      const transactionSnap = await getDoc(transactionRef);
      if (transactionSnap.exists()) {
        setTransaction({ id: transactionSnap.id, ...transactionSnap.data() } as Transaction);
      }
    };
    fetchTransaction();
  }, [transactionId]);

  // Confirm transaction completion
  const handleConfirmTransaction = async () => {
    if (!transaction || !user) return;

    const transactionRef = doc(db, 'transactions', transaction.id);
    const newStatus = transaction.status === 'pending' ? 'confirmed' : 'completed';

    await updateDoc(transactionRef, { status: newStatus });

    setTransaction((prev) => (prev ? { ...prev, status: newStatus } : null));
  };

  // Submit rating
  const handleSubmitRating = async () => {
    if (!transaction || !user) return;

    const transactionRef = doc(db, 'transactions', transaction.id);

    // Determine if user1 or user2 is submitting the rating
    const ratingField = user.uid === transaction.user1Id ? 'user1Rating' : 'user2Rating';
    await updateDoc(transactionRef, { [ratingField]: rating });

    // Update the rating in the component state
    setTransaction((prev) =>
      prev ? { ...prev, [ratingField]: rating } : null
    );

    alert('Rating submitted successfully');
  };

  if (!transaction) return <p>Loading transaction...</p>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>Transaction Details</h2>
      <p><strong>Item ID:</strong> {transaction.itemId}</p>
      <p><strong>Status:</strong> {transaction.status}</p>

      {/* Confirm Transaction Button */}
      {transaction.status !== 'completed' && (
        <button onClick={handleConfirmTransaction}>
          {transaction.status === 'pending' ? 'Confirm Transaction' : 'Complete Transaction'}
        </button>
      )}

      {/* Rating Input */}
      {transaction.status === 'completed' && (
        <div style={{ marginTop: '20px' }}>
          <h3>Rate Your Experience</h3>
          <input
            type="number"
            min="1"
            max="5"
            placeholder="Rate from 1 to 5"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          />
          <button onClick={handleSubmitRating}>Submit Rating</button>
        </div>
      )}

      {/* Display Ratings if Completed */}
      {transaction.user1Rating && <p>User 1 Rating: {transaction.user1Rating}</p>}
      {transaction.user2Rating && <p>User 2 Rating: {transaction.user2Rating}</p>}
    </div>
  );
};

export default Transaction;
