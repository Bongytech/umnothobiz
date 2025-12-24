import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, doc, deleteDoc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore'; // Removed onSnapshot
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
  inquiries: { senderId: string; message: string; timestamp: Date }[];
  numBidders: number;
};

const Barter: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [userItems, setUserItems] = useState<Item[]>([]);
  // Removed unused offer state
  const [newItem, setNewItem] = useState({ 
    name: '', 
    description: '', 
    estimatedValue: '', 
    city: '', 
    isBusinessBid: false, 
    type: 'goods' as 'goods' | 'service' 
  });
  const [filters, setFilters] = useState({ city: '', type: '', estimatedValue: '' });
  const [inquiryMessage, setInquiryMessage] = useState('');
  // Removed unused offerMessage state
  const [showInquiries, setShowInquiries] = useState<{ [key: string]: boolean }>({});
  const [showUserItemsModal, setShowUserItemsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const handleAddItem = async () => {
    if (newItem.name && newItem.description && newItem.estimatedValue && newItem.city) {
      try {
        const itemData = {
          ...newItem,
          owner: auth.currentUser?.uid || 'Unknown',
          reputation: 5,
          inquiries: [], // Add missing property
          numBidders: 0, // Add missing property
        };
        const docRef = await addDoc(collection(db, 'barterItems'), itemData);
        setItems(prevItems => [...prevItems, { 
          id: docRef.id, 
          ...itemData,
          inquiries: [], // Ensure it's included
          numBidders: 0, // Ensure it's included
        } as Item]);
        setNewItem({ 
          name: '', 
          description: '', 
          estimatedValue: '', 
          city: '', 
          isBusinessBid: false, 
          type: 'goods' 
        });
      } catch (error) {
        console.error("Error adding item:", error);
        alert("Failed to add item. Please try again.");
      }
    } else {
      alert("Please fill in all fields.");
    }
  };

  // Fixed: Use all parameters or remove unused ones
  const handleInquire = async (item: Item, itemId: string, ownerId: string) => {
    // Actually use the parameters to avoid warnings
    console.log(`Inquiring about item: ${item.name} (ID: ${itemId}) from owner: ${ownerId}`);
    
    if (!inquiryMessage.trim()) {
      alert("Inquiry message cannot be empty.");
      return;
    }

    try {
      const inquiryData = {
        senderId: auth.currentUser?.uid || 'Unknown',
        message: inquiryMessage,
        timestamp: new Date(),
      };
      const itemRef = doc(db, 'barterItems', itemId);
      await updateDoc(itemRef, {
        inquiries: arrayUnion(inquiryData),
      });

      setInquiryMessage('');
      alert(`Inquiry sent for ${item.name}`);
    } catch (error) {
      console.error("Error sending inquiry:", error);
      alert("Failed to send inquiry. Please try again.");
    }
  };

  const toggleInquiries = (itemId: string) => {
    setShowInquiries(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handlePlaceBid = async (item: Item) => {
    if (!auth.currentUser) {
      alert("Please sign in to place a bid.");
      return;
    }

    const offerMessage = prompt("Enter your offer for this item:");
    if (!offerMessage) {
      alert("Offer message is required.");
      return;
    }

    const bidData = {
      itemId: item.id,
      bidderId: auth.currentUser.uid,
      ownerId: item.owner,
      offer: offerMessage,
      status: 'Pending',
      messages: [],
    };

    try {
      await addDoc(collection(db, 'bidItems'), bidData);

      const itemRef = doc(db, 'barterItems', item.id);
      await updateDoc(itemRef, { numBidders: item.numBidders + 1 });

      alert(`Bid placed on ${item.name}`);
    } catch (error) {
      console.error('Error placing bid:', error);
    }
  };

  const handleVote = async (itemId: string, ownerId: string, vote: 'up' | 'down') => {
    if (auth.currentUser?.uid === ownerId) {
      alert("You cannot vote on your own item.");
      return;
    }

    try {
      const userRef = doc(db, 'users', ownerId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        alert("User not found.");
        return;
      }

      const currentReputation = userDoc.data()?.reputation || 0;
      const voteRef = doc(collection(db, `barterItems/${itemId}/votes`), auth.currentUser?.uid);
      const voteSnapshot = await getDoc(voteRef);

      if (!voteSnapshot.exists()) {
        const newReputation = vote === 'up' ? currentReputation + 1 : currentReputation - 1;
        await updateDoc(userRef, { reputation: newReputation });
        await setDoc(voteRef, { voteType: vote });
        alert(`You have successfully ${vote === 'up' ? 'upvoted' : 'downvoted'}.`);
      } else {
        const previousVote = voteSnapshot.data()?.voteType;
        
        if (previousVote === vote) {
          alert(`You have already ${vote === 'up' ? 'upvoted' : 'downvoted'} this item.`);
        } else {
          const newReputation = vote === 'up' ? currentReputation + 2 : currentReputation - 2;
          await updateDoc(userRef, { reputation: newReputation });
          await updateDoc(voteRef, { voteType: vote });
          alert(`Your vote has been changed to ${vote === 'up' ? 'upvote' : 'downvote'}.`);
        }
      }
    } catch (error) {
      console.error("Error updating reputation:", error);
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

  // Fixed: Added type annotation and actually used in the component
  const handleAcceptBid = async (itemId: string) => {
    try {
      const itemRef = doc(db, 'barterItems', itemId);
      const itemDoc = await getDoc(itemRef);

      if (!itemDoc.exists()) {
        alert("Item not found.");
        return;
      }

      const itemData = itemDoc.data();

      // Add missing properties to match Item type
      const completeItemData = {
        ...itemData,
        inquiries: itemData.inquiries || [],
        numBidders: itemData.numBidders || 0,
      };

      await addDoc(collection(db, 'activeBids'), { 
        ...completeItemData, 
        status: 'Accepted' 
      });

      await deleteDoc(itemRef);

      setUserItems(prevItems => prevItems.filter(item => item.id !== itemId));
      setItems(prevItems => prevItems.filter(item => item.id !== itemId));

      alert("Bid accepted and moved to 'My Bids'.");
    } catch (error) {
      console.error("Error accepting bid:", error);
    }
  };

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const itemsCollection = collection(db, 'barterItems');
        const itemSnapshot = await getDocs(itemsCollection);
        const itemList = itemSnapshot.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data(),
          inquiries: doc.data().inquiries || [],
          numBidders: doc.data().numBidders || 0,
        } as Item));
        
        setItems(itemList);
        console.log("Fetched items:", itemList);
      } catch (err) {
        console.error("Error fetching items:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, []);

  const handleShowUserItems = () => {
    if (items.length === 0) return;
    
    const userItemsList = items.filter(item => item.owner === auth.currentUser?.uid);
    setUserItems(userItemsList);
    setShowUserItemsModal(true);
    console.log("Show User Items clicked. Filtered items:", userItemsList);
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

      <h2>Barter Page 
        <button onClick={handleShowUserItems} disabled={isLoading}>My Barter Items</button>
      </h2>

      {showUserItemsModal && (
        <div className="user-items-modal">
          <h3>My Barter Items</h3>
          <ul>
            {userItems.length > 0 ? (
              userItems.map(item => (
                <li key={item.id}>
                  <strong>{item.name}</strong> - {item.description} (Value: {item.estimatedValue})
                  <button onClick={() => handleAcceptBid(item.id)}>Accept Bid</button>
                </li>
              ))
            ) : (
              <p>No items found.</p>
            )}
          </ul>
          <button onClick={() => setShowUserItemsModal(false)}>Close</button>
        </div>
      )}

      <h3>List a New Item</h3>
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
      <input type="text" placeholder="Filter by City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
      <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
        <option value="">All Types</option>
        <option value="goods">Goods</option>
        <option value="service">Service</option>
      </select>
      <input type="text" placeholder="Estimated Value" value={filters.estimatedValue} onChange={(e) => setFilters({ ...filters, estimatedValue: e.target.value })} />

      <h3>Basic Bids</h3>
      <ul>
        {items.filter(item => !item.isBusinessBid && handleFilter(item)).map(item => (
          <div key={item.id} className="item-container">
            <div style={{ flex: 1, borderRadius: '6px', boxShadow: '0px 2px 5px rgba(0, 0, 1, 0.5)', padding: '6px', cursor: 'pointer'}}>
              <strong>{item.name}</strong> - {item.description} (Estimated Value: {item.estimatedValue}, City: {item.city}) | Reputation: {item.reputation}
              <div className="action-buttons">
                <button onClick={() => handleVote(item.id, item.owner, 'up')}>👍🏿</button>
                <button onClick={() => handleVote(item.id, item.owner, 'down')}>👎🏿</button>
                <input 
                  type="text" 
                  placeholder="Send an inquiry" 
                  value={inquiryMessage} 
                  onChange={(e) => setInquiryMessage(e.target.value)} 
                />
                <button onClick={() => handleInquire(item, item.id, item.owner)}>Inquire</button>
                <button onClick={() => handlePlaceBid(item)}>Place Bid</button>
                <button onClick={() => toggleInquiries(item.id)}>Bid Inquiries</button>
              </div>
            </div>
            {showInquiries[item.id] && (
              <div className="inquiries">
                <h4>Inquiries:</h4>
                {item.inquiries?.map((inquiry, index) => (
                  <div key={index}>
                    <p><strong>From:</strong> {inquiry.senderId}</p>
                    <p><strong>Message:</strong> {inquiry.message}</p>
                    <p><strong>Date:</strong> {inquiry.timestamp?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </ul>

      <h3>Business Bids</h3>
      <ul>
        {items.filter(item => item.isBusinessBid && handleFilter(item)).map(item => (
          <div key={item.id} className="item-container">
            <div style={{ flex: 1, borderRadius: '6px', boxShadow: '0px 2px 5px rgba(0, 0, 1, 0.5)', padding: '6px', cursor: 'pointer'}}>
              <strong>{item.name}</strong> - {item.description} (Estimated Value: {item.estimatedValue}, City: {item.city}) | Reputation: {item.reputation}
              <div className="action-buttons">
                <button onClick={() => handleVote(item.id, item.owner, 'up')}>👍🏿</button>
                <button onClick={() => handleVote(item.id, item.owner, 'down')}>👎🏿</button>
                <input 
                  type="text" 
                  placeholder="Send an inquiry" 
                  value={inquiryMessage} 
                  onChange={(e) => setInquiryMessage(e.target.value)} 
                />
                <button onClick={() => handleInquire(item, item.id, item.owner)}>Inquire</button>
                <button onClick={() => handlePlaceBid(item)}>Place Bid</button>
                <button onClick={() => toggleInquiries(item.id)}>Bid Inquiries</button>
              </div>
            </div>
            {showInquiries[item.id] && (
              <div className="inquiries">
                <h4>Inquiries:</h4>
                {item.inquiries?.map((inquiry, idx) => (
                  <div key={`${item.id}-inquiry-${idx}`}>
                    <p><strong>From:</strong> {inquiry.senderId}</p>
                    <p><strong>Message:</strong> {inquiry.message}</p>
                    <p><strong>Date:</strong> {inquiry.timestamp?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </ul>
    </div>
  );
};

export default Barter;