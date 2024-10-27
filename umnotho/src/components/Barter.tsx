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
};

type UserProfile = {
  displayName: string;
  reputation: number;
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
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(null); // State to hold owner profile
  const navigate = useNavigate();

  // Fetch items from Firestore on component mount
  useEffect(() => {
    const fetchItems = async () => {
      const itemsCollection = collection(db, 'barterItems');
      const itemSnapshot = await getDocs(itemsCollection);
      const itemList = itemSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
      setItems(itemList);
    };
    fetchItems();
  }, []);

  // Fetch the owner's profile when an item is selected
  const fetchOwnerProfile = async (ownerId: string) => {
    const ownerRef = doc(db, 'users', ownerId);
    const ownerSnap = await getDoc(ownerRef);
    if (ownerSnap.exists()) {
      const ownerData = ownerSnap.data() as UserProfile;
      setOwnerProfile(ownerData);
    } else {
      setOwnerProfile(null);  // Reset if no owner found
    }
  };

  // Handle item selection to view details
  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    fetchOwnerProfile(item.owner);  // Fetch owner's profile data
  };

  // Add new item to Firestore
  const handleAddItem = async () => {
    if (newItem.name && newItem.description && newItem.value && newItem.city) {
      const itemData = {
        ...newItem,
        owner: auth.currentUser?.uid || 'Unknown',
      };
      const docRef = await addDoc(collection(db, 'barterItems'), itemData);
      setItems([...items, { id: docRef.id, ...itemData }]);
      setNewItem({ name: '', description: '', value: '', city: '' });
    } else {
      alert("Please fill in all fields.");
    }
  };

  const handleOfferClick = (item: Item) => {
    alert(`Offer made on item: ${item.name}`);
    // Add offer logic here, if needed
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
            <div style={{ flex: 1 }} onClick={() => handleItemSelect(item)}>
              <strong>{item.name}</strong> - {item.description} (Value: {item.value}, City: {item.city})
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
          {ownerProfile ? (
            <>
              <p><strong>Owner:</strong> {ownerProfile.displayName}</p>
              <p><strong>Reputation:</strong> {ownerProfile.reputation}</p>
            </>
          ) : (
            <p>Loading owner details...</p>
          )}
          <button onClick={() => setSelectedItem(null)}>Close</button>
        </div>
      )}
    </div>
  );
};

export default Barter;
