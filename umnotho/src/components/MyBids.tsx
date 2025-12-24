// src/components/MyBids.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { collection, getDocs, query, where, orderBy, updateDoc, doc, arrayUnion, getDoc, deleteDoc, runTransaction} from 'firebase/firestore'; // Removed addDoc
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
  const [showRatingPopup] = useState<{ [key: string]: boolean }>({});
  const [showCompleted, setShowCompleted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBids = async () => {
      if (!auth.currentUser) return;

      try {
        const activeBidsRef = collection(db, 'activeBids');

        const myBidItemsQuery = query(
          activeBidsRef,
          where('ownerId', '==', auth.currentUser.uid),
          orderBy('lastUpdated', 'desc')
        );
        const myBidItemsSnapshot = await getDocs(myBidItemsQuery);
        const myBidItemsData = myBidItemsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Bid));

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

const handleUpdateStatus = async (bidId: string, newStatus: string, otherUserId?: string) => {
  try {
	if (newStatus === 'Complete' && otherUserId) {
      console.log(`Completing bid with user ID: ${otherUserId}`);
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

  } catch (error) {
    console.error("Error updating bid status:", error);
  }
};
 
const handleReturnToBarter = async (bidId: string) => {
  console.log("Attempting to return bid to barter items, bidId:", bidId);

  // Define a type for the bid data
  type BidDataType = {
    [key: string]: any;
  };

  let bidData: BidDataType | null = null; // Initialize with proper type

  try {
    const bidRef = doc(db, 'activeBids', bidId);
    const bidSnapshot = await getDoc(bidRef);

    if (!bidSnapshot.exists()) {
      console.error("Bid data not found for bidId:", bidId);
      return;
    }

    bidData = bidSnapshot.data() as BidDataType;

    setMyBidItems((prevItems) => prevItems.filter((item) => item.id !== bidId));

    const barterRef = collection(db, 'barterItems');

    await runTransaction(db, async (transaction) => {
      const bidDoc = await transaction.get(bidRef);
      if (!bidDoc.exists()) {
        throw new Error("Bid no longer exists in activeBids.");
      }

      if (bidData) {
        transaction.set(doc(barterRef, bidId), bidData);
      }
      transaction.delete(bidRef);
    });

    alert("Item successfully returned to Barter Items.");
  } catch (error) {
    console.error("Error moving bid back to barter items:", error);

    if (bidData) {
      setMyBidItems((prevItems) => [...prevItems, { id: bidId, ...bidData } as Bid]);
    }
  }
};

const handleRateUser = async (otherUserId: string, rating: 'up' | 'down', bidId: string) => {
  try {
    const userRef = doc(db, 'users', otherUserId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const currentReputation = userDoc.data().reputation || 0;
	  console.log(currentReputation);
      const newReputation = rating === 'up' ? currentReputation + 1 : currentReputation - 1;
      await updateDoc(userRef, { reputation: newReputation });
	  console.log(newReputation, bidId);
    }
    
  } catch (error) {
    console.error("Error rating user:", error);
  }
};

 // Handle bid cancellation
  const handleCancelBid = async (bidId: string) => {
    try {
      await deleteDoc(doc(db, 'activeBids', bidId));
      setMyPlacedBids((prevBids) => prevBids.filter(bid => bid.id !== bidId));
      alert("Bid canceled successfully.");
    } catch (error) {
      console.error("Error canceling bid:", error);
      alert("Failed to cancel bid. Please try again.");
    }
  };

  const activeBidItems = myBidItems.filter(bid => bid.status !== 'Complete');
  const activePlacedBids = myPlacedBids.filter(bid => bid.status !== 'Complete');
  const completedBidItems = myBidItems.filter(bid => bid.status === 'Complete');
  const completedPlacedBids = myPlacedBids.filter(bid => bid.status === 'Complete');

  return (
    <div className="my-bids-container">
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

      {/* Active Bids */}
      <h3>My Active Bid Items</h3>
      {activeBidItems.length > 0 ? (
        activeBidItems.map((bid) => (
          <div key={bid.id} className="bid-item">
            <div>
              <strong>{bid.name}</strong> - {bid.description} (Estimated Value: {bid.estimatedValue}, City: {bid.city})
            </div>
            <p>Status: {bid.status}</p>
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
              onChange={(e) => setNewMessages((prev) => ({ ...prev, [bid.id]: e.target.value }))}
            />
            <button onClick={() => handleSendMessage(bid.id)}>Send</button>
			<button onClick={() => handleRateUser(bid.ownerId, 'up', bid.id)}>👍🏿 Upvote</button>
                  <button onClick={() => handleRateUser(bid.ownerId, 'down', bid.id)}>👎🏿 Downvote</button>
            <h4>Update Status</h4>
              
                <>
                  <button onClick={() => handleUpdateStatus(bid.id, 'In Negotiation', bid.ownerId)}>In Negotiation</button>
                  <button onClick={() => handleUpdateStatus(bid.id, 'Complete', bid.ownerId)}>Complete</button>
                  <button onClick={() => handleReturnToBarter(bid.id)}>Return to Barter</button> {/* Fixed: removed second parameter */}
                </>
              
              {showRatingPopup[bid.id] && (
                <div className="rating-popup">
                  <p>Rate the other user:</p>
                  <button onClick={() => handleRateUser(bid.ownerId, 'up', bid.id)}>👍🏿 Upvote</button>
                  <button onClick={() => handleRateUser(bid.ownerId, 'down', bid.id)}>👎🏿 Downvote</button>
                </div>
              )}
          </div>
        ))
      ) : (
        <p>No active bid items available.</p>
      )}

      <h3>My Placed Active Bids</h3>
      {activePlacedBids.length > 0 ? (
        activePlacedBids.map((bid) => (
          <div key={bid.id} className="bid-item">
            <div>
              <strong>{bid.name}</strong> - {bid.description} (Estimated Value: {bid.estimatedValue}, City: {bid.city})
            </div>
            <p>Status: {bid.status}</p>
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
              onChange={(e) => setNewMessages((prev) => ({ ...prev, [bid.id]: e.target.value }))}
            />
            <button onClick={() => handleSendMessage(bid.id)}>Send</button>
             <button onClick={() => handleRateUser(bid.ownerId, 'up', bid.id)}>👍🏿</button>
                  <button onClick={() => handleRateUser(bid.ownerId, 'down', bid.id)}>👎🏿</button>
            <h4>Update Status</h4>
              
                <>
                  <button onClick={() => handleUpdateStatus(bid.id, 'In Negotiation', bid.ownerId)}>In Negotiation</button>
                  <button onClick={() => handleUpdateStatus(bid.id, 'Complete', bid.ownerId)}>Complete</button>
                  <button onClick={() => handleCancelBid(bid.id)}>Cancel Bid</button>
                </>
              
              
          </div>
        ))
      ) : (
        <p>No active placed bids available.</p>
      )}

      <button onClick={() => setShowCompleted(!showCompleted)}>
        {showCompleted ? "Hide Completed Bids" : "Show Completed Bids"}
      </button>

      {showCompleted && (
        <>
          <h3>Completed Bid Items</h3>
          {completedBidItems.length > 0 ? (
            completedBidItems.map((bid) => (
              <div key={bid.id} className="bid-item">
                <div>
                  <strong>{bid.name}</strong> - {bid.description} (Estimated Value: {bid.estimatedValue}, City: {bid.city})
                </div>
                <p>Status: {bid.status}</p>
                <h4>Messages</h4>
                <div className="messages">
                  {bid.messages.map((msg, index) => (
                    <p key={index}>
                      <strong>{usernames[msg.senderId] || "Unknown User"}:</strong> {msg.content}
                    </p>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p>No completed bid items available.</p>
          )}

          <h3>Completed Placed Bids</h3>
          {completedPlacedBids.length > 0 ? (
            completedPlacedBids.map((bid) => (
              <div key={bid.id} className="bid-item">
                <div>
                  <strong>{bid.name}</strong> - {bid.description} (Estimated Value: {bid.estimatedValue}, City: {bid.city})
                </div>
                <p>Status: {bid.status}</p>
                <h4>Messages</h4>
                <div className="messages">
                  {bid.messages.map((msg, index) => (
                    <p key={index}>
                      <strong>{usernames[msg.senderId] || "Unknown User"}:</strong> {msg.content}
                    </p>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p>No completed placed bids available.</p>
          )}
        </>
      )}
    </div>
  );
};

export default MyBids;