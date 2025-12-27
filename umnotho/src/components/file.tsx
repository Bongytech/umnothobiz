import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import './Barter.css';

type Item = {
  id: string;
  name: string;
  description: string;
  estimatedValue: string;
  owner: string;
  city: string;
  reputation: number;
  isBusinessBid: boolean;
  type: 'goods' | 'service';
  inquiries: { senderId: string; message: string; timestamp: Date }[];
};

const Barter: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [userItems, setUserItems] = useState<Item[]>([]);
  const [showUserItemsModal, setShowUserItemsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);  // Loading state
  const navigate = useNavigate();

  // Fetch items and update loading state
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const itemsCollection = collection(db, 'barterItems');
        const itemSnapshot = await getDocs(itemsCollection);
        const itemList = itemSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Item));
        
        setItems(itemList);
        console.log("Fetched items:", itemList); // Debug log
      } catch (err) {
        console.error("Error fetching items:", err);
      } finally {
        setIsLoading(false);  // Set loading to false once items are fetched
      }
    };
    fetchItems();
  }, []);

  // Handle button click to display user's items
  const handleShowUserItems = () => {
    if (items.length === 0) return;  // Prevents any action if items are not loaded yet
    
    const userItemsList = items.filter(item => item.owner === auth.currentUser?.uid);
    setUserItems(userItemsList);
    setShowUserItemsModal(true);
    console.log("Show User Items clicked. Filtered items:", userItemsList); // Debug log
  };

  return (
    <div className="barter-container">
      <nav className="navbar">
        <div className="nav-logo" onClick={() => navigate('/')}>
          <img src="path/to/logo.png" alt="Logo" style={{ cursor: 'pointer', height: '40px' }} />
        </div>
        <div className="nav-buttons">
          <button onClick={() => navigate('/pricing')}>Pricing</button>
          <button onClick={() => navigate('/my-bids')}>My Bids</button>
          <button onClick={() => navigate('/logout')}>Logout</button>
        </div>
      </nav>

      <h2>Barter Page 
        <button onClick={handleShowUserItems} disabled={isLoading}>My Barter Items</button> 
        {/* Button disabled until items are loaded */}
      </h2>

      {/* Display user's barter items in modal */}
      {showUserItemsModal && (
        <div className="user-items-modal">
          <h3>My Barter Items</h3>
          <ul>
            {userItems.length > 0 ? (
              userItems.map(item => (
                <li key={item.id}>
                  <strong>{item.name}</strong> - {item.description} (Value: {item.estimatedValue})
                </li>
              ))
            ) : (
              <p>No items found.</p>
            )}
          </ul>
          <button onClick={() => setShowUserItemsModal(false)}>Close</button>
        </div>
      )}
    </div>
  );
};

export default Barter;
