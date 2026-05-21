import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { collection, getDocs, query, where, orderBy, updateDoc, doc, arrayUnion, getDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';

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
  const [showCompleted, setShowCompleted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBids = async () => {
      if (!auth.currentUser) return;
      try {
        const activeBidsRef = collection(db, 'activeBids');
        const myBidItemsQuery = query(activeBidsRef, where('ownerId', '==', auth.currentUser.uid), orderBy('lastUpdated', 'desc'));
        const myBidItemsSnapshot = await getDocs(myBidItemsQuery);
        const myBidItemsData = myBidItemsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Bid));

        const myPlacedBidsQuery = query(activeBidsRef, where('bidderId', '==', auth.currentUser.uid), orderBy('lastUpdated', 'desc'));
        const myPlacedBidsSnapshot = await getDocs(myPlacedBidsQuery);
        const myPlacedBidsData = myPlacedBidsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Bid));

        setMyBidItems(myBidItemsData);
        setMyPlacedBids(myPlacedBidsData);

        const allMessages = [...myBidItemsData, ...myPlacedBidsData].flatMap(bid => bid.messages || []);
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

  const handleSendMessage = async (bidId: string) => {
    const messageContent = newMessages[bidId];
    if (!messageContent) return;
    const messageData = { senderId: auth.currentUser?.uid || 'Unknown', content: messageContent, timestamp: new Date() };
    try {
      const bidRef = doc(db, 'activeBids', bidId);
      await updateDoc(bidRef, { messages: arrayUnion(messageData) });
      setNewMessages((prev) => ({ ...prev, [bidId]: '' }));
      setMyBidItems(prev => prev.map(bid => bid.id === bidId ? { ...bid, messages: [...(bid.messages||[]), messageData] } : bid));
      setMyPlacedBids(prev => prev.map(bid => bid.id === bidId ? { ...bid, messages: [...(bid.messages||[]), messageData] } : bid));
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleUpdateStatus = async (bidId: string, newStatus: string) => {
    try {
      const bidRef = doc(db, 'activeBids', bidId);
      await updateDoc(bidRef, { status: newStatus });
      setMyBidItems(prev => prev.map(bid => bid.id === bidId ? { ...bid, status: newStatus } : bid));
      setMyPlacedBids(prev => prev.map(bid => bid.id === bidId ? { ...bid, status: newStatus } : bid));
      if (newStatus === 'Complete') {
        setShowRatingPopup(prev => ({ ...prev, [bidId]: true }));
      }
    } catch (error) {
      console.error("Error updating bid status:", error);
    }
  };

  const handleReturnToBarter = async (bidId: string) => {
    try {
      const bidRef = doc(db, 'activeBids', bidId);
      const bidSnapshot = await getDoc(bidRef);
      if (!bidSnapshot.exists()) return;
      const bidData = bidSnapshot.data();
      setMyBidItems(prev => prev.filter(item => item.id !== bidId));
      const barterRef = collection(db, 'barterItems');
      await runTransaction(db, async (transaction) => {
        const bidDoc = await transaction.get(bidRef);
        if (!bidDoc.exists()) throw new Error("Bid no longer exists.");
        transaction.set(doc(barterRef, bidId), bidData);
        transaction.delete(bidRef);
      });
      alert("Item returned to Barter Items.");
    } catch (error) {
      console.error("Error moving bid back:", error);
    }
  };

  const handleRateUser = async (otherUserId: string, rating: 'up' | 'down', bidId: string) => {
    try {
      const userRef = doc(db, 'users', otherUserId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const currentReputation = userDoc.data().reputation || 0;
        const newReputation = rating === 'up' ? currentReputation + 1 : currentReputation - 1;
        await updateDoc(userRef, { reputation: newReputation });
        setShowRatingPopup(prev => ({ ...prev, [bidId]: false }));
        alert("Rating submitted!");
      }
    } catch (error) {
      console.error("Error rating user:", error);
    }
  };

  const handleCancelBid = async (bidId: string) => {
    try {
      await deleteDoc(doc(db, 'activeBids', bidId));
      setMyPlacedBids(prev => prev.filter(bid => bid.id !== bidId));
      alert("Bid canceled.");
    } catch (error) {
      console.error("Error canceling bid:", error);
    }
  };

  const activeBidItems = myBidItems.filter(bid => bid.status !== 'Complete');
  const activePlacedBids = myPlacedBids.filter(bid => bid.status !== 'Complete');
  const completedBidItems = myBidItems.filter(bid => bid.status === 'Complete');
  const completedPlacedBids = myPlacedBids.filter(bid => bid.status === 'Complete');

  const BidCard = ({ bid, type }: { bid: Bid, type: 'received' | 'placed' }) => (
    <div className="bg-dark-900 border border-white/5 rounded-2xl p-6 flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-display font-bold text-white mb-1">{bid.name || 'Unknown Item'}</h3>
          <p className="text-sm text-gray-400">{bid.description}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${bid.status === 'Complete' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-umnotho/10 text-umnotho border border-umnotho/20'}`}>
          {bid.status || 'Pending'}
        </span>
      </div>

      <div className="flex-1 bg-dark-950 rounded-xl p-4 mb-4 border border-white/5 overflow-y-auto max-h-48 space-y-3">
        {(bid.messages || []).map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.senderId === auth.currentUser?.uid ? 'items-end' : 'items-start'}`}>
            <span className="text-xs text-gray-500 mb-1">{usernames[msg.senderId] || "User"}</span>
            <div className={`px-3 py-2 rounded-lg text-sm ${msg.senderId === auth.currentUser?.uid ? 'bg-umnotho text-dark-950' : 'bg-dark-800 text-gray-300'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {(!bid.messages || bid.messages.length === 0) && <p className="text-gray-500 text-sm text-center mt-4">No messages yet.</p>}
      </div>

      {bid.status !== 'Complete' && (
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessages[bid.id] || ''}
            onChange={(e) => setNewMessages((prev) => ({ ...prev, [bid.id]: e.target.value }))}
            className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-umnotho/50"
          />
          <button onClick={() => handleSendMessage(bid.id)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white transition-colors">
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      )}

      {bid.status !== 'Complete' && (
        <div className="flex flex-wrap gap-2 mt-auto">
          {type === 'received' ? (
            <>
              <button onClick={() => handleUpdateStatus(bid.id, 'In Negotiation')} className="flex-1 py-2 bg-dark-800 hover:bg-dark-700 text-white text-sm font-medium rounded-lg transition-colors border border-white/5">Negotiate</button>
              <button onClick={() => handleUpdateStatus(bid.id, 'Complete')} className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium rounded-lg transition-colors border border-green-500/20">Complete</button>
              <button onClick={() => handleReturnToBarter(bid.id)} className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20 mt-2">Return to Barter</button>
            </>
          ) : (
            <>
              <button onClick={() => handleUpdateStatus(bid.id, 'In Negotiation',)} className="flex-1 py-2 bg-dark-800 hover:bg-dark-700 text-white text-sm font-medium rounded-lg transition-colors border-white/5">Negotiate</button>
              <button onClick={() => handleUpdateStatus(bid.id, 'Complete')} className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium rounded-lg transition-colors border-green-500/20">Complete</button>
              <button onClick={() => handleCancelBid(bid.id)} className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20 mt-2">Cancel Bid</button>
            </>
          )}
        </div>
      )}

      {showRatingPopup[bid.id] && (
        <div className="absolute inset-0 bg-dark-950/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 z-10">
          <h4 className="text-white font-bold mb-4">Rate your experience</h4>
          <div className="flex gap-4">
            <button onClick={() => handleRateUser(type === 'received' ? bid.bidderId : bid.ownerId, 'up', bid.id)} className="p-4 bg-dark-800 rounded-full hover:bg-umnotho hover:text-dark-950 transition-colors text-white">
              <ThumbsUp className="w-6 h-6" />
            </button>
            <button onClick={() => handleRateUser(type === 'received' ? bid.bidderId : bid.ownerId, 'down', bid.id)} className="p-4 bg-dark-800 rounded-full hover:bg-red-500 hover:text-white transition-colors text-white">
              <ThumbsDown className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <nav className="h-20 flex justify-between items-center px-6 md:px-12 border-b border-white/5 bg-dark-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-full bg-umnotho flex items-center justify-center text-dark-950 font-bold text-xl">U</div>
          <span className="text-xl font-display font-bold text-white tracking-tight hidden sm:block">Umnotho</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/barter')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Barter Market</button>
          <button onClick={() => auth.signOut().then(() => navigate('/auth'))} className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors">Logout</button>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-display font-bold text-white">My Bids</h1>
          <button onClick={() => setShowCompleted(!showCompleted)} className="px-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-sm text-white hover:bg-dark-700 transition-colors">
            {showCompleted ? "Hide Completed" : "Show Completed"}
          </button>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-8 bg-umnotho rounded-full"></span> Offers Received
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeBidItems.map(bid => <BidCard key={bid.id} bid={bid} type="received" />)}
              {activeBidItems.length === 0 && <p className="text-gray-500 col-span-full">No active offers received.</p>}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-8 bg-blue-500 rounded-full"></span> My Placed Bids
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activePlacedBids.map(bid => <BidCard key={bid.id} bid={bid} type="placed" />)}
              {activePlacedBids.length === 0 && <p className="text-gray-500 col-span-full">No active bids placed.</p>}
            </div>
          </section>

          {showCompleted && (
            <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-8 border-t border-white/5">
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
                <span className="w-2 h-8 bg-green-500 rounded-full"></span> Completed Transactions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedBidItems.map(bid => <BidCard key={bid.id} bid={bid} type="received" />)}
                {completedPlacedBids.map(bid => <BidCard key={bid.id} bid={bid} type="placed" />)}
                {completedBidItems.length === 0 && completedPlacedBids.length === 0 && <p className="text-gray-500 col-span-full">No completed transactions yet.</p>}
              </div>
            </motion.section>
          )}
        </div>
      </main>
    </div>
  );
};

export default MyBids;
