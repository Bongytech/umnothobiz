// src/components/Barter.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, doc, deleteDoc, getDoc } from 'firebase/firestore';
import './Barter.css';
import logo from '../assets/Umnotho2.png';

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
};


const Barter: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState({ name: '', description: '', estimatedValue: '', city: '', isBusinessBid: false, type: 'goods' });
  const [filters, setFilters] = useState({ city: '', type: '', estimatedValue: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const itemsCollection = collection(db, 'barterItems');
        const itemSnapshot = await getDocs(itemsCollection);
        const itemList = itemSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Item));
        setItems(itemList);
      } catch (err) {
        console.error("Error fetching items:", err);
      }
    };
    fetchItems();
  }, []);

  const handleAddItem = async () => {
    if (newItem.name && newItem.description && newItem.estimatedValue && newItem.city) {
      try {
        const itemData = {
          ...newItem,
          owner: auth.currentUser?.uid || 'Unknown',
		  type: newItem.type as 'goods' | 'service', 
          reputation: 5,
        };
        const docRef = await addDoc(collection(db, 'barterItems'), itemData);
        setItems([...items, { id: docRef.id, ...itemData }]);
        setNewItem({ name: '', description: '', estimatedValue: '', city: '', isBusinessBid: false, type: 'goods' });
      } catch (error) {
        console.error("Error adding item:", error);
        alert("Failed to add item. Please try again.");
      }
    } else {
      alert("Please fill in all fields.");
    }
  };

  const handlePlaceBid = async (item: Item) => {
	   if (item.owner === auth.currentUser?.uid) {
      alert("You cannot place a bid on your own item.");
      return;
    }
  try {
    // Fetch the original item from `barterItems` to get all details
    const itemRef = doc(db, 'barterItems', item.id);
    const itemSnapshot = await getDoc(itemRef);

    if (!itemSnapshot.exists()) {
      alert("Item does not exist.");
      return;
    }

    const itemData = itemSnapshot.data();

    /*const activeBidData = {
      itemId: item.id,
      bidderId: auth.currentUser?.uid || 'Unknown',
      ownerId: itemData.owner,  // Use the owner from the original item
      status: 'Pending',
      messages: [],
      agreed: false,
      lastUpdated: new Date(),  // Add lastUpdated timestamp for ordering
      // Add additional fields from `itemData`
      name: itemData.name,
      description: itemData.description,
      estimatedValue: itemData.estimatedValue,
      city: itemData.city,
      type: itemData.type,
      isBusinessBid: itemData.isBusinessBid,
      reputation: itemData.reputation,  // Carry over reputation if needed
    };*/

    // Add the item to the `activeBids` collection
    //const docRef = await addDoc(collection(db, 'activeBids'), activeBidData);

    // Remove the item from `barterItems`
    await deleteDoc(itemRef);

    // Update state and notify user
    setItems(items.filter((i) => i.id !== item.id));  // Remove item from local state
    alert(`Bid placed on item: ${itemData.name}. Coordination started.`);
    //setActiveBid({ id: docRef.id, ...activeBidData });
  } catch (error) {
    console.error("Error placing bid:", error);
    alert("Failed to place bid. Please try again.");
  }
};


  const handleFilter = (item: Item) => {
    const { city, type, estimatedValue } = filters;
    return (
      (!city || item.city.toLowerCase().includes(city.toLowerCase())) &&
      (!type || item.type === type) &&
      (!estimatedValue || item.estimatedValue === estimatedValue)
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="barter-container">
      <nav className="navbar">
        <div className="nav-logo" onClick={() => navigate('/')}>
          <img src={logo} alt="Umnotho Logo" style={{ cursor: 'pointer', height: '40px' }} />
        </div>
        <div className="nav-buttons">
          <button className="nav-button" onClick={() => navigate('/pricing')}>Pricing</button>
          <button className="nav-button" onClick={() => navigate('/my-bids')}>My Bids</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <h2>Barter Page</h2>

      <h3>List a New Item</h3>
      {/* New Item Inputs */}
      <input type="text" placeholder="Item Name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
      <input type="text" placeholder="Description" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
      <input type="text" placeholder="Estimated Value" value={newItem.estimatedValue} onChange={(e) => setNewItem({ ...newItem, estimatedValue: e.target.value })} />
      <input type="text" placeholder="City" value={newItem.city} onChange={(e) => setNewItem({ ...newItem, city: e.target.value })} />
      <label>
        Business Bid <input type="checkbox" checked={newItem.isBusinessBid} onChange={(e) => setNewItem({ ...newItem, isBusinessBid: e.target.checked })} />
      </label>
      <label>
        <select value={newItem.type} onChange={(e) => setNewItem({ ...newItem, type: e.target.value as 'goods' | 'service' })}>
          <option value="goods">Goods</option>
          <option value="service">Service</option>
        </select>
      </label>
      <button onClick={handleAddItem}>Add Item</button>

      <h3>Search & Filter</h3>
      {/* Filter Inputs */}
      <input type="text" placeholder="Filter by City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
      <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
        <option value="">All Types</option>
        <option value="goods">Goods</option>
        <option value="service">Service</option>
      </select>
      <input type="text" placeholder="Estimated Value" value={filters.estimatedValue} onChange={(e) => setFilters({ ...filters, estimatedValue: e.target.value })} />

      {/* Display Filtered Items */}
      <h3>Basic Bids</h3>
      <ul>
        {items.filter(item => !item.isBusinessBid && handleFilter(item)).map(item => (
          <li key={item.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <strong>{item.name}</strong> - {item.description} (Estimated Value: {item.estimatedValue}, City: {item.city}) | Reputation: {item.reputation}
            </div>
            <button onClick={() => handlePlaceBid(item)}>Place Bid</button>
          </li>
        ))}
      </ul>

      <h3>Business Bids</h3>
      <ul>
        {items.filter(item => item.isBusinessBid && handleFilter(item)).map(item => (
          <li key={item.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <strong>{item.name}</strong> - {item.description} (Estimated Value: {item.estimatedValue}, City: {item.city}) | Reputation: {item.reputation}
            </div>
            <button onClick={() => handlePlaceBid(item)}>Place Bid</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Barter;
