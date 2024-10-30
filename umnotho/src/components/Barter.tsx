// src/components/Barter.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
//import GooglePayButton from '@google-pay/button-react';
//import { useAuth } from './useAuth';
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

type ActiveBid = {
  id: string;
  itemId: string;
  bidderId: string;
  ownerId: string;
  status: string;
  messages: { senderId: string; content: string; timestamp: Date }[];
  agreed: boolean;
};
const Barter: React.FC = () => {
 // const { user, updateSubscription } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState({ name: '', description: '', estimatedValue: '', city: '', isBusinessBid: false, type: 'goods' });
  //const [ setSelectedItem] = useState<Item | null>(null);
  const [filters, setFilters] = useState({ city: '', type: '', estimatedValue: '' });
  const navigate = useNavigate();
  const [activeBid, setActiveBid] = useState<ActiveBid | null>(null);
  const [message, setMessage] = useState('');

  // Fetch items from Firestore and categorize into Basic and Business Bids
   useEffect(() => {
  const fetchItems = async () => {
    try {
      const itemsCollection = collection(db, 'barterItems');
      const itemSnapshot = await getDocs(itemsCollection);
      
      const itemList =
        itemSnapshot.docs.map(doc =>({id: doc.id, ...doc.data() } as Item));

      setItems(itemList);
      console.log("Fetched items:", itemList);
    } catch (err) {
      console.error("Error fetching items:", err);
    } 
  };

  fetchItems();
}, []);

  // Filter items based on user input
  /*const filteredItems = items.filter((item) => {
    const matchesCity = filters.city === '' || item.city.toLowerCase().includes(filters.city.toLowerCase());
    const matchesType = filters.type === '' || item.type === filters.type;
    const matchesEstimatedValue = filters.estimatedValue === '' || item.estimatedValue === filters.estimatedValue;
    return matchesCity && matchesType && matchesEstimatedValue;
  });
 */


const handleAddItem = async () => {
  // Check if all required fields are filled
  if (newItem.name && newItem.description && newItem.estimatedValue && newItem.city) {
    try {
      const itemData = {
        ...newItem,
        owner: auth.currentUser?.uid || 'Unknown',
        type: newItem.type as 'goods' | 'service', // Explicitly cast type
        reputation: 5, // Initial reputation
      };
      
      // Add the item to Firestore and update local state
      const docRef = await addDoc(collection(db, 'barterItems'), itemData);
      setItems([...items, { id: docRef.id, ...itemData }]);
      
      // Reset newItem to default values
      setNewItem({
        name: '',
        description: '',
        estimatedValue: '',
        city: '',
        isBusinessBid: false,
        type: 'goods',
      });
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Failed to add item. Please try again.");
    }
  } else {
    alert("Please fill in all fields.");
  }
};


  // Move item to 'activeBids' and remove from 'barterItems'
    const handlePlaceBid = async (item: Item) => {
    try {
      const activeBidData = {
        itemId: item.id,
        bidderId: auth.currentUser?.uid || 'Unknown',
        ownerId: item.owner,
        status: 'Pending',
        messages: [],
        agreed: false,
      };
      const docRef = await addDoc(collection(db, 'activeBids'), activeBidData);
      await deleteDoc(doc(db, 'barterItems', item.id));
      setItems(items.filter((i) => i.id !== item.id));
      alert(`Bid placed on item: ${item.name}. Coordination started.`);
      setActiveBid({ id: docRef.id, ...activeBidData });
    } catch (error) {
      console.error("Error placing bid:", error);
      alert("Failed to place bid. Please try again.");
    }
  };
  // Handle payment success for upgrading subscription
 /* const handlePaymentSuccess = async (subscriptionType: 'basic' | 'biz') => {
    try {
      await updateSubscription(subscriptionType);
      alert(`Subscription upgraded to ${subscriptionType}`);
    } catch (error) {
      console.error("Error updating subscription:", error);
    }
  };*/

 // Send a message within an active bid
  const handleSendMessage = async () => {
    if (!activeBid || !message.trim()) return;
    const messageData = {
      senderId: auth.currentUser?.uid || 'Unknown',
      content: message,
      timestamp: new Date(),
    };
    try {
      const activeBidRef = doc(db, 'activeBids', activeBid.id);
      await updateDoc(activeBidRef, { messages: arrayUnion(messageData) });
      setActiveBid({
        ...activeBid,
        messages: [...activeBid.messages, messageData],
      });
      setMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

 // Update bid status (for example, from "Pending" to "In Negotiation" or "Agreed")
  const handleUpdateStatus = async (newStatus: string) => {
    if (!activeBid) return;
    try {
      const activeBidRef = doc(db, 'activeBids', activeBid.id);
      await updateDoc(activeBidRef, { status: newStatus, agreed: newStatus === 'Agreed' });
      setActiveBid({ ...activeBid, status: newStatus, agreed: newStatus === 'Agreed' });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };
  //const handleLogin = () => navigate('/auth');
  const handlePricing = () => navigate('/pricing');
  //const handleSignUp = () => navigate('/signup');
  const handleLogoClick = () => navigate('/'); // Navigate to landing page

  // Logout user
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
	  {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo" onClick={handleLogoClick}>
          <img src={logo} alt="Umnotho Logo" style={{ cursor: 'pointer', height: '40px' }} />
        </div>
        <div className="nav-buttons">
        <button className="nav-button" onClick={handlePricing}>Pricing</button>
        <button onClick={handleLogout}>Logout</button>
        </div>
      </nav>
      <h2>Barter Page</h2>
      

      <h3>List a New Item</h3>
      <input type="text" placeholder="Item Name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
      <input type="text" placeholder="Description" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
      <input type="text" placeholder="Estimated Value (e.g., $50)" value={newItem.estimatedValue} onChange={(e) => setNewItem({ ...newItem, estimatedValue: e.target.value })} />
      <input type="text" placeholder="City" value={newItem.city} onChange={(e) => setNewItem({ ...newItem, city: e.target.value })} />
      <label>
        <input
          type="checkbox"
          checked={newItem.isBusinessBid}
          onChange={(e) => setNewItem({ ...newItem, isBusinessBid: e.target.checked })}
        />
        Business Bid
      </label>
      <label>
        <select value={newItem.type} onChange={(e) => setNewItem({ ...newItem, type: e.target.value as 'goods' | 'service' })}>
          <option value="goods">Goods</option>
          <option value="service">Service</option>
        </select>
      </label>
      <button onClick={handleAddItem}>Add Item</button>

      {/* Search and Filter Section */}
      <h3>Search & Filter</h3>
      <input
        type="text"
        placeholder="Filter by City"
        value={filters.city}
        onChange={(e) => setFilters({ ...filters, city: e.target.value })}
      />
      <select
        value={filters.type}
        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
      >
        <option value="">All Types</option>
        <option value="goods">Goods</option>
        <option value="service">Service</option>
      </select>
      <input
        type="text"
        placeholder="Estimated Value"
        value={filters.estimatedValue}
        onChange={(e) => setFilters({ ...filters, estimatedValue: e.target.value })}
      />

            <h3>Basic Bids</h3>
      <ul>
        {items.filter(item => !item.isBusinessBid).map((item) => (
          <li key={item.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}/* onClick={() => setSelectedItem(item)}*/>
              <strong>{item.name}</strong> - {item.description} (Estimated Value: {item.estimatedValue}, City: {item.city}) | Reputation: {item.reputation}
            </div>
            <button onClick={() => handlePlaceBid(item)}>Place Bid</button>
          </li>
        ))}
      </ul>

      <h3>Business Bids</h3>
      <ul>
        {items.filter(item => item.isBusinessBid).map((item) => (
          <li key={item.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}/* onClick={() => setSelectedItem(item)}*/ >
              <strong>{item.name}</strong> - {item.description} (Estimated Value: {item.estimatedValue}, City: {item.city}) | Reputation: {item.reputation}
            </div>
            <button onClick={() => handlePlaceBid(item)}>Place Bid</button>
          </li>
        ))}
      </ul>

      {/* Coordination Section */}
      {activeBid && (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid black' }}>
          <h4>Coordination for Bid</h4>
          <p><strong>Status:</strong> {activeBid.status}</p>
          {activeBid.messages.map((msg, idx) => (
            <div key={idx}>
              <strong>{msg.senderId === auth.currentUser?.uid ? "You" : "Owner"}:</strong> {msg.content}
            </div>
          ))}
          <input
            type="text"
            placeholder="Send a message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button onClick={handleSendMessage}>Send Message</button>

          <h4>Update Status</h4>
          <button onClick={() => handleUpdateStatus('In Negotiation')}>In Negotiation</button>
          <button onClick={() => handleUpdateStatus('Agreed')}>Agree</button>
        </div>
      )}
    </div>
  );
};

export default Barter;