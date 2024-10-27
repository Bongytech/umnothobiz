// src/components/Barter.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, doc, getDoc } from 'firebase/firestore';

type Item = {
  id: string;
  name: string;
  description: string;
  value: string;
  owner: string;
  city: string;
  reputation: number;  // New field for reputation
};

const Barter: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState<{ name: string; description: string; value: string; city: string }>({
    name: '',
    description: '',
    value: '',
    city: '',
  });
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const navigate = useNavigate();

  // Fetch items and reputation data from Firestore on component mount
  useEffect(() => {
    const fetchItems = async () => {
      const itemsCollection = collection(db, 'barterItems');
      const itemSnapshot = await getDocs(itemsCollection);
      
      // Fetch each item along with the owner's reputation
      const itemList = await Promise.all(itemSnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const ownerRef = doc(db, 'users', data.owner);
        const ownerSnap = await getDoc(ownerRef);
        
        return {
          id: docSnap.id,
          ...data,
          reputation: ownerSnap.exists() ? ownerSnap.data().reputation : 0  // Default to 0 if no reputation
        } as Item;
      }));

      setItems(itemList);
    };
    fetchItems();
  }, []);

  // Add new item to Firestore
  const handleAddItem = async () => {
    if (newItem.name && newItem.description && newItem.value && newItem.city) {
      const itemData = {
        ...newItem,
        owner: auth.currentUser?.uid || 'Unknown',
      };
      const docRef = await addDoc(collection(db, 'barterItems'), itemData);
      setItems([...items, { id: docRef.id, ...itemData, reputation: 5 }]); // Default reputation
      setNewItem({ name: '', description: '', value: '', city: '' });
    } else {
      alert("Please fill in all fields.");
    }
  };

  const handleOfferClick = (item: Item) => {
    alert(`Offer made on item: ${item.name}`);
    // More offer logic can be added here.
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/auth");
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Barter Page</h2>
      <button onClick={handleLogout}>Logout</button>
      
      <h3>List a New Item</h3>
      <input
        type="text"
        placeholder="Item Name"
        value={newItem.name}
        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
      />
      <input
        type="text"
        placeholder="Description"
        value={newItem.description}
        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
      />
      <input
        type="text"
        placeholder="Value (e.g., $50)"
        value={newItem.value}
        onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
      />
      <input
        type="text"
        placeholder="City"
        value={newItem.city}
        onChange={(e) => setNewItem({ ...newItem, city: e.target.value })}
      />
      <button onClick={handleAddItem}>Add Item</button>

      <h3>View Bids</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ flex: 1 }} onClick={() => setSelectedItem(item)}>
              <strong>{item.name}</strong> - {item.description} (Value: {item.value}, City: {item.city}) | Reputation: {item.reputation}
            </div>
            <button onClick={() => handleOfferClick(item)}>Offer</button>
          </li>
        ))}
      </ul>

      {selectedItem && (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid black' }}>
          <h4>Item Details</h4>
          <p><strong>Name:</strong> {selectedItem.name}</p>
          <p><strong>Description:</strong> {selectedItem.description}</p>
          <p><strong>Value:</strong> {selectedItem.value}</p>
          <p><strong>City:</strong> {selectedItem.city}</p>
          <p><strong>Reputation:</strong> {selectedItem.reputation}</p>
          <button onClick={() => setSelectedItem(null)}>Close</button>
        </div>
      )}
    </div>
  );
};

export default Barter;
