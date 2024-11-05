// src/components/MyBids.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { collection, getDocs, query, where, orderBy, updateDoc, doc, arrayUnion, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './MyBids.css';
import logo from '../assets/Umnotho2.png';

type Bid = {
  id: string;
  itemId: string;
  bidderId: string;
  ownerId: string;
  status: string;
  messages: { senderId: string; content: string; timestamp: Date }[];
  agreed: boolean;
  lastUpdated: Date;
  name: string;
  description: string;
  estimatedValue: string;
  city: string;
  type: 'goods' | 'service';
  isBusinessBid: boolean;
  reputation: number;
};

const MyBids: React.FC = () => {
  const [myBidItems, setMyBidItems] = useState<Bid[]>([]);
  const [myPlacedBids, setMyPlacedBids] = useState<Bid[]>([]);
  const [newMessages, setNewMessages] = useState<{ [key: string]: string }>({});
  const [usernames, setUsernames] = useState<{ [key: string]: string }>({});
  const [showRatingPopup, setShowRatingPopup] = useState<{ [key: string]: boolean }>({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBids = async () => {
      if (!auth.currentUser) return;

      try {
        const activeBidsRef = collection(db, 'activeBids');

        // Fetch My Bid Items
        const myBidItemsQuery = query(
          activeBidsRef,
          where('ownerId', '==', auth.currentUser.uid),
          orderBy('lastUpdated', 'desc')
        );
        const myBidItemsSnapshot = await getDocs(myBidItemsQuery);
        const myBidItemsData = myBidItemsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Bid));

        // Fetch My Placed Bids
        const myPlacedBidsQuery = query(
          activeBidsRef,
          where('bidderId', '==', auth.currentUser.uid),
          orderBy('lastUpdated', 'desc')
        );
        const myPlacedBidsSnapshot = await getDocs(myPlacedBidsQuery);
        const myPlacedBidsData = myPlacedBidsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Bid));

        setMyBidItems(myBidItemsData);
        setMyPlacedBids(myPlacedBidsData);

        const allMessages = [...myBidItemsData, ...myPlacedBidsData].flatMap(bid => bid.messages);
        const uniqueSenderIds = Array.from(new Set(allMessages.map(msg => msg.senderId)));
        await fetchUsernames(uniqueSenderIds);
      } catch (error) {
        console.error("Error fetching bids:", error);
      }
    };

    fetchBids();
  }, []);

  const fetchUsernames = async (userIds: string[]) => {
    const newUsernames = { ...usernames };
    for (const userId of userIds) {
      if (!newUsernames[userId]) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        newUsernames[userId] = userDoc.exists() ? userDoc.data().displayName || "Unknown User" : "Unknown User";
      }
    }
    setUsernames(newUsernames);
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/auth");
  };

  const handleLogoClick = () => navigate('/');

  const handleSendMessage = async (bidId: string) => {
    const messageContent = newMessages[bidId];
    if (!messageContent) return;

    const messageData = {
      senderId: auth.currentUser?.uid || 'Unknown',
      content: messageContent,
      timestamp: new Date(),
    };

    try {
      const bidRef = doc(db, 'activeBids', bidId);
      await updateDoc(bidRef, { messages: arrayUnion(messageData) });

      setNewMessages((prev) => ({ ...prev, [bidId]: '' }));
      setMyBidItems((prevBids) =>
        prevBids.map((bid) =>
          bid.id === bidId ? { ...bid, messages: [...bid.messages, messageData] } : bid
        )
      );
      setMyPlacedBids((prevBids) =>
        prevBids.map((bid) =>
          bid.id === bidId ? { ...bid, messages: [...bid.messages, messageData] } : bid
        )
      );
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Update bid status
  const handleUpdateStatus = async (bidId: string, newStatus: string, otherUserId?: string) => {
  try {
	if (newStatus === 'Complete' && otherUserId) {
      // Log or process `otherUserId` as needed
      console.log(`Completing bid with user ID: #######`);
    }
    const bidRef = doc(db, 'activeBids', bidId);
    await updateDoc(bidRef, { status: newStatus });

    setMyBidItems((prevBids) =>
      prevBids.map((bid) =>
        bid.id === bidId ? { ...bid, status: newStatus } : bid
      )
    );
    setMyPlacedBids((prevBids) =>
      prevBids.map((bid) =>
        bid.id === bidId ? { ...bid, status: newStatus } : bid
      )
    );

    if (newStatus === 'Complete') {
      setShowRatingPopup((prev) => ({ ...prev, [bidId]: true }));
    }
  } catch (error) {
    console.error("Error updating bid status:", error);
  }
};


  // Handle rating for other user
  const handleRateUser = async (otherUserId: string, rating: 'up' | 'down', bidId: string) => {
  try {
    const userRef = doc(db, 'users', otherUserId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const currentReputation = userDoc.data().reputation || 0;
      const newReputation = rating === 'up' ? currentReputation + 1 : currentReputation - 1;
      await updateDoc(userRef, { reputation: newReputation });
    }
    setShowRatingPopup((prev) => ({ ...prev, [bidId]: false }));  // Hide rating popup after rating
  } catch (error) {
    console.error("Error rating user:", error);
  }
};


  const handleMessageChange = (bidId: string, content: string) => {
    setNewMessages((prev) => ({ ...prev, [bidId]: content }));
  };

  return (
    <div className="my-bids-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo" onClick={handleLogoClick}>
          <img src={logo} alt="Umnotho Logo" style={{ cursor: 'pointer', height: '40px' }} />
        </div>
        <div className="nav-buttons">
          <button onClick={() => navigate('/barter')}>Barter</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <h2>My Bids</h2>

      {/* My Bid Items */}
      <h3>My Bid Items</h3>
      {myBidItems.length > 0 ? (
        <div className="bid-card">
          {myBidItems.map((bid) => (
            <div key={bid.id} className="bid-item">
              <div>
                <strong>{bid.name}</strong> - {bid.description} (Estimated Value: {bid.estimatedValue}, City: {bid.city})
              </div>
              <p>Status: {bid.status}</p>
              <p>Reputation: {bid.reputation}</p>

              <h4>Messages</h4>
              <div className="messages">
                {bid.messages.map((msg, index) => (
                  <p key={index}>
                    <strong>{usernames[msg.senderId] || "Unknown User"}:</strong> {msg.content}
                  </p>
                ))}
              </div>

              <input
                type="text"
                placeholder="Send a message"
                value={newMessages[bid.id] || ''}
                onChange={(e) => handleMessageChange(bid.id, e.target.value)}
              />
              <button onClick={() => handleSendMessage(bid.id)}>Send</button>

              <h4>Update Status</h4>
              {bid.status !== 'Complete' && (
                <>
                  <button onClick={() => handleUpdateStatus(bid.id, 'In Negotiation', bid.ownerId)}>In Negotiation</button>
                  <button onClick={() => handleUpdateStatus(bid.id, 'Complete', bid.ownerId)}>Complete</button>
                </>
              )}
              {showRatingPopup[bid.id] && (
                <div className="rating-popup">
                  <p>Rate the other user:</p>
                  <button onClick={() => handleRateUser(bid.ownerId, 'up', bid.id)}>👍 Upvote</button>
                  <button onClick={() => handleRateUser(bid.ownerId, 'down', bid.id)}>👎 Downvote</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>No bid items available.</p>
      )}

      {/* My Placed Bids */}
      <h3>My Placed Bids</h3>
      {myPlacedBids.length > 0 ? (
        <div className="bid-card">
          {myPlacedBids.map((bid) => (
            <div key={bid.id} className="bid-item">
              <div>
                <strong>{bid.name}</strong> - {bid.description} (Estimated Value: {bid.estimatedValue}, City: {bid.city})
              </div>
              <p>Status: {bid.status}</p>
              <p>Reputation: {bid.reputation}</p>

              <h4>Messages</h4>
              <div className="messages">
                {bid.messages.map((msg, index) => (
                  <p key={index}>
                    <strong>{usernames[msg.senderId] || "Unknown User"}:</strong> {msg.content}
                  </p>
                ))}
              </div>

              <input
                type="text"
                placeholder="Send a message"
                value={newMessages[bid.id] || ''}
                onChange={(e) => handleMessageChange(bid.id, e.target.value)}
              />
              <button onClick={() => handleSendMessage(bid.id)}>Send</button>

              <h4>Update Status</h4>
              
                <>
                  <button onClick={() => handleUpdateStatus(bid.id, 'In Negotiation', bid.ownerId)}>In Negotiation</button>
                  <button onClick={() => handleUpdateStatus(bid.id, 'Complete', bid.ownerId)}>Complete</button>
                </>
              
              {showRatingPopup[bid.id] && (
                <div className="rating-popup">
                  <p>Rate the other user:</p>
                  <button onClick={() => handleRateUser(bid.ownerId, 'up', bid.id)}>👍 Upvote</button>
                  <button onClick={() => handleRateUser(bid.ownerId, 'down', bid.id)}>👎 Downvote</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>No placed bids available.</p>
      )}
    </div>
  );
};

export default MyBids;
