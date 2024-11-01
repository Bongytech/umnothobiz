// src/components/MyBids.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { collection, getDocs, doc, updateDoc, query, where, arrayUnion, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/Umnotho2.png';
import './MyBids.css';

type ActiveBid = {
  id: string;
  itemId: string;
  name: string;
  description: string;
  estimatedValue: string;
  city: string;
  type: 'goods' | 'service';
  status: string;
  messages: { senderId: string; content: string; timestamp: Date }[];
  agreed: boolean;
  lastUpdated: Date;
};

const MyBids: React.FC = () => {
  const [activeBids, setActiveBids] = useState<ActiveBid[]>([]);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ status: '', search: '' });
  const navigate = useNavigate();
 
 

  useEffect(() => {
    const fetchActiveBids = async () => {
      // Check if the user is authenticated
      if (!auth.currentUser) {
        console.error("User is not authenticated.");
		
        return;
      }

      try {
        const activeBidsRef = collection(db, 'activeBids');
        const activeBidsQuery = query(
          activeBidsRef,
          where('bidderId', '==', auth.currentUser.uid),  // Check for authenticated user
          orderBy('lastUpdated', 'desc')
        );
        const querySnapshot = await getDocs(activeBidsQuery);
        const bids = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ActiveBid));
        setActiveBids(bids);
      } catch (error) {
        console.error("Error fetching active bids:", error);
      }
    };

    fetchActiveBids();
  }, [auth.currentUser]); // Dependency on auth.currentUser

  const handleSendMessage = async (bidId: string) => {
    if (!message.trim()) return;
    const messageData = {
      senderId: auth.currentUser?.uid || 'Unknown',
      content: message,
      timestamp: new Date(),
    };
    const bidRef = doc(db, 'activeBids', bidId);
    await updateDoc(bidRef, {
      messages: arrayUnion(messageData),
      lastUpdated: messageData.timestamp,
    });
    setActiveBids(activeBids.map(bid => bid.id === bidId ? { ...bid, messages: [...bid.messages, messageData], lastUpdated: messageData.timestamp } : bid));
    setMessage('');
  };

  const handleUpdateStatus = async (bidId: string, newStatus: string) => {
    const bidRef = doc(db, 'activeBids', bidId);
    const newTimestamp = new Date();
    await updateDoc(bidRef, {
      status: newStatus,
      agreed: newStatus === 'Agreed',
      lastUpdated: newTimestamp,
    });
    setActiveBids(activeBids.map(bid => bid.id === bidId ? { ...bid, status: newStatus, agreed: newStatus === 'Agreed', lastUpdated: newTimestamp } : bid));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };
 

  const filteredBids = activeBids.filter(bid => 
    (filters.status ? bid.status === filters.status : true) &&
    (filters.search ? bid.name.toLowerCase().includes(filters.search.toLowerCase()) || bid.city.toLowerCase().includes(filters.search.toLowerCase()) : true)
  );

  return (
    <div className="mybids-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo" onClick={() => navigate('/')}>
          <img src={logo} alt="Umnotho Logo" style={{ cursor: 'pointer', height: '40px' }} />
        </div>
        <div className="nav-buttons">
          <button className="nav-button" onClick={() => navigate('/barter')}>Barter</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <h2>My Bids</h2>

      {/* Filter and Search Section */}
      <div className="filter-search">
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Negotiation">In Negotiation</option>
          <option value="Agreed">Agreed</option>
        </select>
        <input
          type="text"
          placeholder="Search by name or city"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
      </div>

      {/* Display Bids */}
      {filteredBids.map((bid) => (
        <div key={bid.id} className="bid-card">
          <h4>Bid on Item: {bid.name}</h4>
          <p><strong>Description:</strong> {bid.description}</p>
          <p><strong>Estimated Value:</strong> {bid.estimatedValue}</p>
          <p><strong>City:</strong> {bid.city}</p>
          <p><strong>Type:</strong> {bid.type}</p>
          <p><strong>Status:</strong> {bid.status}</p>
          {bid.messages.map((msg, idx) => (
            <div key={idx}>
              <strong>{msg.senderId === auth.currentUser?.uid ? "You" : "Owner"}:</strong> {msg.content}
            </div>
          ))}
          <input type="text" placeholder="Send a message" value={message} onChange={(e) => setMessage(e.target.value)} />
          <button onClick={() => handleSendMessage(bid.id)}>Send Message</button>

          <h4>Update Status</h4>
          <button onClick={() => handleUpdateStatus(bid.id, 'In Negotiation')}>In Negotiation</button>
          <button onClick={() => handleUpdateStatus(bid.id, 'Agreed')}>Agree</button>
        </div>
      ))}
    </div>
  );
};

export default MyBids;
