import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, ThumbsUp, ThumbsDown, MessageSquare, Gavel, X, MapPin, Tag } from 'lucide-react';

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
  const [setUserItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState({ 
    name: '', description: '', estimatedValue: '', city: '', isBusinessBid: false, type: 'goods' as 'goods' | 'service' 
  });
  const [filters, setFilters] = useState({ city: '', type: '', estimatedValue: '' });
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [showInquiries, setShowInquiries] = useState<{ [key: string]: boolean }>({});
  const [ setShowUserItemsModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
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
      } catch (err) {
        console.error("Error fetching items:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, [isAuthenticated]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (isAuthLoading) {
    return <div className="min-h-screen bg-dark-950 flex items-center justify-center text-umnotho">Loading...</div>;
  }

  const handleAddItem = async () => {
    if (newItem.name && newItem.description && newItem.estimatedValue && newItem.city) {
      try {
        const itemData = {
          ...newItem,
          owner: auth.currentUser?.uid || 'Unknown',
          reputation: 5,
          inquiries: [],
          numBidders: 0,
        };
        const docRef = await addDoc(collection(db, 'barterItems'), itemData);
        setItems(prev => [{ id: docRef.id, ...itemData } as Item, ...prev]);
        setNewItem({ name: '', description: '', estimatedValue: '', city: '', isBusinessBid: false, type: 'goods' });
        setShowAddItemModal(false);
      } catch (error) {
        console.error("Error adding item:", error);
        alert("Failed to add item.");
      }
    } else {
      alert("Please fill in all fields.");
    }
  };

  const handleInquire = async (item: Item, itemId: string) => {
    if (!inquiryMessage.trim()) return alert("Message cannot be empty.");
    try {
      const inquiryData = { senderId: auth.currentUser?.uid || 'Unknown', message: inquiryMessage, timestamp: new Date() };
      const itemRef = doc(db, 'barterItems', itemId);
      await updateDoc(itemRef, { inquiries: arrayUnion(inquiryData) });
      setInquiryMessage('');
      alert(`Inquiry sent for ${item.name}`);
    } catch (error) {
      console.error("Error sending inquiry:", error);
    }
  };

  const handlePlaceBid = async (item: Item) => {
    if (!auth.currentUser) return alert("Please sign in.");
    const offerMessage = prompt("Enter your offer for this item:");
    if (!offerMessage) return;
    const bidData = {
      itemId: item.id, bidderId: auth.currentUser.uid, ownerId: item.owner,
      offer: offerMessage, status: 'Pending', messages: [],
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
    if (auth.currentUser?.uid === ownerId) return alert("Cannot vote on your own item.");
    try {
      const userRef = doc(db, 'users', ownerId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) return;
      const currentReputation = userDoc.data()?.reputation || 0;
      const voteRef = doc(collection(db, `barterItems/${itemId}/votes`), auth.currentUser?.uid);
      const voteSnapshot = await getDoc(voteRef);

      if (!voteSnapshot.exists()) {
        const newReputation = vote === 'up' ? currentReputation + 1 : currentReputation - 1;
        await updateDoc(userRef, { reputation: newReputation });
        await setDoc(voteRef, { voteType: vote });
      } else {
        const previousVote = voteSnapshot.data()?.voteType;
        if (previousVote !== vote) {
          const newReputation = vote === 'up' ? currentReputation + 2 : currentReputation - 2;
          await updateDoc(userRef, { reputation: newReputation });
          await updateDoc(voteRef, { voteType: vote });
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

  const ItemCard = ({ item }: { item: Item }) => (
    <div className="bg-dark-900 border border-white/5 rounded-2xl p-6 hover:border-umnotho/30 transition-all group flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-display font-bold text-white mb-1">{item.name}</h3>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.city}</span>
            <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {item.type}</span>
            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">Value: {item.estimatedValue}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-dark-800 rounded-full px-2 py-1 border border-white/5">
          <button onClick={() => handleVote(item.id, item.owner, 'up')} className="p-1 hover:text-umnotho text-gray-400 transition-colors"><ThumbsUp className="w-4 h-4" /></button>
          <span className="text-xs font-bold text-white min-w-[20px] text-center">{item.reputation}</span>
          <button onClick={() => handleVote(item.id, item.owner, 'down')} className="p-1 hover:text-red-400 text-gray-400 transition-colors"><ThumbsDown className="w-4 h-4" /></button>
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-6 flex-1">{item.description}</p>
      
      <div className="space-y-3 mt-auto">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Quick inquiry..." 
            value={inquiryMessage} 
            onChange={(e) => setInquiryMessage(e.target.value)}
            className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-umnotho/50"
          />
          <button onClick={() => handleInquire(item, item.id, item.owner)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border-white/10 text-white transition-colors">
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handlePlaceBid(item)} className="flex-1 py-2 bg-umnotho text-dark-950 font-semibold rounded-lg hover:bg-umnotho-hover transition-colors flex items-center justify-center gap-2 text-sm">
            <Gavel className="w-4 h-4" /> Place Bid
          </button>
          <button onClick={() => setShowInquiries(p => ({...p, [item.id]: !p[item.id]}))} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white text-sm font-medium transition-colors">
            {item.inquiries?.length || 0} Inquiries
          </button>
        </div>
      </div>

      {showInquiries[item.id] && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-white/5 space-y-3">
          {item.inquiries?.map((inq, idx) => (
            <div key={idx} className="bg-dark-800 rounded-lg p-3 text-sm">
              <span className="text-umnotho font-medium block mb-1">User {inq.senderId.slice(0,4)}</span>
              <p className="text-gray-300">{inq.message}</p>
            </div>
          ))}
          {(!item.inquiries || item.inquiries.length === 0) && <p className="text-gray-500 text-sm text-center">No inquiries yet.</p>}
        </motion.div>
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
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => navigate('/pricing')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Pricing</button>
          <button onClick={() => navigate('/my-bids')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">My Bids</button>
          <button onClick={() => { setUserItems(items.filter(i => i.owner === auth.currentUser?.uid)); setShowUserItemsModal(true); }} className="text-sm font-medium px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all">My Items</button>
          <button onClick={handleLogout} className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors ml-2">Logout</button>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">Exchange Market</h1>
            <p className="text-gray-400">Discover items and services available for trade.</p>
          </div>
          <button onClick={() => setShowAddItemModal(true)} className="px-6 py-3 bg-umnotho text-dark-950 font-semibold rounded-full hover:bg-umnotho-hover transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.2)]">
            <Plus className="w-5 h-5" /> List New Item
          </button>
        </div>

        {/* Filters */}
        <div className="bg-dark-900 border border-white/5 rounded-2xl p-4 mb-8 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input type="text" placeholder="Filter by City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} className="w-full bg-dark-800 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-umnotho/50" />
          </div>
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="bg-dark-800 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-umnotho/50">
            <option value="">All Types</option>
            <option value="goods">Goods</option>
            <option value="service">Service</option>
          </select>
          <input type="text" placeholder="Max Value" value={filters.estimatedValue} onChange={(e) => setFilters({ ...filters, estimatedValue: e.target.value })} className="bg-dark-800 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-umnotho/50" />
        </div>

        {/* Grids */}
        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-8 bg-umnotho rounded-full"></span> Basic Bids
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.filter(i => !i.isBusinessBid && handleFilter(i)).map(item => <ItemCard key={item.id} item={item} />)}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-8 bg-blue-500 rounded-full"></span> Business Bids
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.filter(i => i.isBusinessBid && handleFilter(i)).map(item => <ItemCard key={item.id} item={item} />)}
            </div>
          </section>
        </div>
      </main>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddItemModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-dark-900 border border-white/10 rounded-3xl p-8 max-w-md w-full relative">
              <button onClick={() => setShowAddItemModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
              <h2 className="text-2xl font-display font-bold text-white mb-6">List a New Item</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Item Name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-umnotho/50" />
                <textarea placeholder="Description" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-umnotho/50 min-h-[100px]" />
                <div className="flex gap-4">
                  <input type="text" placeholder="Est. Value" value={newItem.estimatedValue} onChange={(e) => setNewItem({ ...newItem, estimatedValue: e.target.value })} className="w-1/2 bg-dark-800 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-umnotho/50" />
                  <input type="text" placeholder="City" value={newItem.city} onChange={(e) => setNewItem({ ...newItem, city: e.target.value })} className="w-1/2 bg-dark-800 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-umnotho/50" />
                </div>
                <div className="flex items-center justify-between bg-dark-800 border border-white/10 rounded-xl py-3 px-4">
                  <span className="text-gray-300">Business Bid</span>
                  <input type="checkbox" checked={newItem.isBusinessBid} onChange={(e) => setNewItem({ ...newItem, isBusinessBid: e.target.checked })} className="w-5 h-5 accent-umnotho" />
                </div>
                <select value={newItem.type} onChange={(e) => setNewItem({ ...newItem, type: e.target.value as 'goods' | 'service' })} className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-umnotho/50">
                  <option value="goods">Goods</option>
                  <option value="service">Service</option>
                </select>
                <button onClick={handleAddItem} className="w-full py-3 mt-4 bg-umnotho text-dark-950 font-semibold rounded-xl hover:bg-umnotho-hover transition-colors">
                  Post Listing
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Barter;
