import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { AnimatePresence, motion } from 'motion/react';
import {
  Gavel,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Tag,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import AppNav from './AppNav';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { BarterItem, Inquiry, ListingType, VoteMap } from '../lib/types';
import {
  EMPTY_LISTING,
  formatRand,
  parseRandValue,
  validateListing,
  validateMessage,
  validateOffer,
} from '../lib/validation';
import type { ListingDraft, ListingErrors } from '../lib/validation';
import { canVote, summarizeVotes, withVote } from '../lib/votes';
import { displayNameFor } from '../lib/user';
import { FullPageLoader } from './RouteGuards';

type Notice = { tone: 'success' | 'error'; text: string };

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function normalizeInquiry(value: unknown): Inquiry {
  const data = (value ?? {}) as Record<string, unknown>;
  return {
    senderId: String(data.senderId ?? ''),
    senderName: String(data.senderName ?? `Trader ${String(data.senderId ?? '').slice(0, 4)}`),
    message: String(data.message ?? ''),
    createdAt: toDate(data.createdAt ?? data.timestamp),
  };
}

function normalizeVotes(value: unknown): VoteMap {
  if (!value || typeof value !== 'object') return {};
  const votes: VoteMap = {};
  for (const [uid, vote] of Object.entries(value as Record<string, unknown>)) {
    if (vote === 'up' || vote === 'down') votes[uid] = vote;
  }
  return votes;
}

function normalizeItem(id: string, value: Record<string, unknown>): BarterItem {
  const rawValue = value.estimatedValue ?? value.value;
  const estimatedValue =
    typeof rawValue === 'number' ? rawValue : (parseRandValue(String(rawValue ?? '')) ?? 0);

  return {
    id,
    ownerId: String(value.ownerId ?? value.owner ?? ''),
    ownerName: String(value.ownerName ?? 'Trader'),
    name: String(value.name ?? 'Untitled listing'),
    description: String(value.description ?? ''),
    estimatedValue,
    city: String(value.city ?? ''),
    type: value.type === 'service' ? 'service' : 'goods',
    isBusinessBid: value.isBusinessBid === true,
    inquiries: Array.isArray(value.inquiries) ? value.inquiries.map(normalizeInquiry) : [],
    votes: normalizeVotes(value.votes),
    createdAt: toDate(value.createdAt),
  };
}

function friendlyError(error: unknown, action: string): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'permission-denied':
      return `You do not have permission to ${action}.`;
    case 'unavailable':
      return 'The database is unreachable. Check your connection and try again.';
    case 'failed-precondition':
      return 'This action needs a Firestore index that has not been deployed yet.';
    case 'resource-exhausted':
      return 'Too many requests right now. Please try again in a moment.';
    default:
      return `Could not ${action}. Please try again.`;
  }
}

export default function Barter() {
  const { user } = useAuth();
  const [items, setItems] = useState<BarterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [view, setView] = useState<'all' | 'mine'>('all');
  const [filters, setFilters] = useState({ city: '', type: '' as '' | ListingType, maxValue: '' });
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [draft, setDraft] = useState<ListingDraft>(EMPTY_LISTING);
  const [draftErrors, setDraftErrors] = useState<ListingErrors>({});
  const [savingItem, setSavingItem] = useState(false);
  const [inquiryDrafts, setInquiryDrafts] = useState<Record<string, string>>({});
  const [expandedInquiries, setExpandedInquiries] = useState<Record<string, boolean>>({});
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [bidItem, setBidItem] = useState<BarterItem | null>(null);
  const [offer, setOffer] = useState('');
  const [offerError, setOfferError] = useState('');
  const [placingBid, setPlacingBid] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'barterItems'), orderBy('createdAt', 'desc'), limit(100)),
      (snapshot) => {
        setItems(snapshot.docs.map((itemDoc) => normalizeItem(itemDoc.id, itemDoc.data())));
        setLoadError('');
        setLoading(false);
      },
      (error: unknown) => {
        console.error('Could not load listings:', error);
        setLoadError(friendlyError(error, 'load listings'));
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const visibleItems = useMemo(() => {
    const city = filters.city.trim().toLowerCase();
    const maxValue = parseRandValue(filters.maxValue);

    return items
      .filter((item) => (view === 'mine' ? item.ownerId === user?.uid : true))
      .filter((item) => (!city ? true : item.city.toLowerCase().includes(city)))
      .filter((item) => (!filters.type ? true : item.type === filters.type))
      .filter((item) => (maxValue === null ? true : item.estimatedValue <= maxValue))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }, [items, filters, view, user?.uid]);

  const basicItems = visibleItems.filter((item) => !item.isBusinessBid);
  const businessItems = visibleItems.filter((item) => item.isBusinessBid);

  const openAddItem = () => {
    setDraft(EMPTY_LISTING);
    setDraftErrors({});
    setShowAddItemModal(true);
  };

  const handleAddItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const errors = validateListing(draft);
    setDraftErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingItem(true);
    try {
      await addDoc(collection(db, 'barterItems'), {
        ownerId: user.uid,
        ownerName: displayNameFor(user),
        name: draft.name.trim(),
        description: draft.description.trim(),
        estimatedValue: parseRandValue(draft.estimatedValue),
        city: draft.city.trim(),
        type: draft.type,
        isBusinessBid: draft.isBusinessBid,
        inquiries: [],
        votes: {},
        createdAt: serverTimestamp(),
      });

      setDraft(EMPTY_LISTING);
      setDraftErrors({});
      setShowAddItemModal(false);
      setNotice({ tone: 'success', text: 'Your listing is live in the exchange market.' });
    } catch (error) {
      console.error('Could not create listing:', error);
      setNotice({ tone: 'error', text: friendlyError(error, 'create that listing') });
    } finally {
      setSavingItem(false);
    }
  };

  const handleInquiry = async (item: BarterItem) => {
    if (!user) return;

    const message = inquiryDrafts[item.id] ?? '';
    const problem = validateMessage(message);
    if (problem) {
      setNotice({ tone: 'error', text: problem });
      return;
    }

    setBusyItemId(item.id);
    try {
      await updateDoc(doc(db, 'barterItems', item.id), {
        inquiries: arrayUnion({
          senderId: user.uid,
          senderName: displayNameFor(user),
          message: message.trim(),
          createdAt: Timestamp.now(),
        }),
      });
      setInquiryDrafts((current) => ({ ...current, [item.id]: '' }));
      setExpandedInquiries((current) => ({ ...current, [item.id]: true }));
      setNotice({ tone: 'success', text: `Question sent to the owner of ${item.name}.` });
    } catch (error) {
      console.error('Could not send inquiry:', error);
      setNotice({ tone: 'error', text: friendlyError(error, 'send that inquiry') });
    } finally {
      setBusyItemId(null);
    }
  };

  const handleVote = async (item: BarterItem, vote: 'up' | 'down') => {
    if (!user) return;
    if (!canVote(item.ownerId, user.uid, item.votes)) {
      setNotice({
        tone: 'error',
        text:
          item.ownerId === user.uid
            ? 'You cannot rate your own listing.'
            : 'You have already rated this listing.',
      });
      return;
    }

    const previousVotes = item.votes;
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, votes: withVote(entry.votes, user.uid, vote) } : entry,
      ),
    );

    try {
      await updateDoc(doc(db, 'barterItems', item.id), { [`votes.${user.uid}`]: vote });
    } catch (error) {
      console.error('Could not save vote:', error);
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, votes: previousVotes } : entry)),
      );
      setNotice({ tone: 'error', text: friendlyError(error, 'save that rating') });
    }
  };

  const openBid = (item: BarterItem) => {
    setBidItem(item);
    setOffer('');
    setOfferError('');
  };

  const handlePlaceBid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !bidItem) return;

    const problem = validateOffer(offer);
    if (problem) {
      setOfferError(problem);
      return;
    }

    setPlacingBid(true);
    setOfferError('');
    try {
      const existing = await getDocs(
        query(
          collection(db, 'activeBids'),
          where('itemId', '==', bidItem.id),
          where('bidderId', '==', user.uid),
          limit(10),
        ),
      );

      const hasOpenOffer = existing.docs.some((bidDoc) => {
        const status = bidDoc.data().status;
        return status === 'Pending' || status === 'In Negotiation';
      });

      if (hasOpenOffer) {
        setOfferError('You already have an open offer on this listing.');
        return;
      }

      await addDoc(collection(db, 'activeBids'), {
        itemId: bidItem.id,
        itemName: bidItem.name,
        itemDescription: bidItem.description,
        itemValue: bidItem.estimatedValue,
        city: bidItem.city,
        type: bidItem.type,
        isBusinessBid: bidItem.isBusinessBid,
        ownerId: bidItem.ownerId,
        ownerName: bidItem.ownerName,
        bidderId: user.uid,
        bidderName: displayNameFor(user),
        offer: offer.trim(),
        status: 'Pending',
        messages: [],
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      });

      setBidItem(null);
      setOffer('');
      setNotice({
        tone: 'success',
        text: `Offer sent for ${bidItem.name}. Track it under My Bids.`,
      });
    } catch (error) {
      console.error('Could not place bid:', error);
      setOfferError(friendlyError(error, 'place that offer'));
    } finally {
      setPlacingBid(false);
    }
  };

  const renderItemCard = (item: BarterItem) => {
    const summary = summarizeVotes(item.votes);
    const myVote = user ? item.votes[user.uid] : undefined;
    const canRate = canVote(item.ownerId, user?.uid, item.votes);
    const isMine = item.ownerId === user?.uid;
    const inquiryValue = inquiryDrafts[item.id] ?? '';
    const showInquiries = expandedInquiries[item.id] === true;

    return (
      <article
        key={item.id}
        className="bg-dark-900 border border-white/5 rounded-2xl p-6 hover:border-umnotho/30 transition-all group flex flex-col h-full"
      >
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="min-w-0">
            <h3 className="text-xl font-display font-bold text-white mb-1 break-words">
              {item.name}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {item.city || 'Location not set'}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" /> {item.type}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                {item.estimatedValue > 0 ? formatRand(item.estimatedValue) : 'Value on request'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Listed by <span className="text-gray-300">{isMine ? 'you' : item.ownerName}</span>
            </p>
          </div>

          <div className="flex items-center gap-1 bg-dark-800 rounded-full px-2 py-1 border border-white/5 shrink-0">
            <button
              type="button"
              onClick={() => handleVote(item, 'up')}
              disabled={!canRate}
              aria-label={`Upvote ${item.name}`}
              title={myVote === 'up' ? 'You upvoted this listing' : 'Upvote this listing'}
              className={`p-1 transition-colors disabled:cursor-not-allowed ${
                myVote === 'up' ? 'text-umnotho' : 'text-gray-400 hover:text-umnotho'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <span
              className="text-xs font-bold text-white min-w-6 text-center"
              title={`${summary.up} up / ${summary.down} down`}
            >
              {summary.score}
            </span>
            <button
              type="button"
              onClick={() => handleVote(item, 'down')}
              disabled={!canRate}
              aria-label={`Downvote ${item.name}`}
              title={myVote === 'down' ? 'You downvoted this listing' : 'Downvote this listing'}
              className={`p-1 transition-colors disabled:cursor-not-allowed ${
                myVote === 'down' ? 'text-red-400' : 'text-gray-400 hover:text-red-400'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-gray-400 text-sm mb-6 flex-1 whitespace-pre-line">{item.description}</p>

        <div className="space-y-3 mt-auto">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={isMine ? 'Ask a question about your listing…' : 'Ask the trader a question…'}
              value={inquiryValue}
              maxLength={1000}
              onChange={(event) =>
                setInquiryDrafts((current) => ({ ...current, [item.id]: event.target.value }))
              }
              aria-label={`Question about ${item.name}`}
              className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-umnotho/50"
            />
            <button
              type="button"
              onClick={() => handleInquiry(item)}
              disabled={busyItemId === item.id}
              aria-label={`Send question about ${item.name}`}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white transition-colors disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openBid(item)}
              disabled={isMine}
              className="flex-1 py-2 bg-umnotho text-dark-950 font-semibold rounded-lg hover:bg-umnotho-hover transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Gavel className="w-4 h-4" /> {isMine ? 'Your listing' : 'Place offer'}
            </button>
            <button
              type="button"
              onClick={() =>
                setExpandedInquiries((current) => ({ ...current, [item.id]: !current[item.id] }))
              }
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white text-sm font-medium transition-colors"
            >
              {item.inquiries.length} Question{item.inquiries.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>

        {showInquiries && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 pt-4 border-t border-white/5 space-y-3"
          >
            {item.inquiries.map((inquiry, index) => (
              <div key={`${inquiry.senderId}-${index}`} className="bg-dark-800 rounded-lg p-3 text-sm">
                <span className="text-umnotho font-medium block mb-1">
                  {inquiry.senderName}
                  {inquiry.createdAt ? (
                    <span className="text-gray-500 font-normal">
                      {' '}
                      · {inquiry.createdAt.toLocaleDateString()}
                    </span>
                  ) : null}
                </span>
                <p className="text-gray-300 whitespace-pre-line">{inquiry.message}</p>
              </div>
            ))}
            {item.inquiries.length === 0 && (
              <p className="text-gray-500 text-sm text-center">No questions yet.</p>
            )}
          </motion.div>
        )}
      </article>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950">
        <AppNav active="barter" />
        <FullPageLoader label="Loading the exchange market…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <AppNav active="barter" />

      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">Exchange Market</h1>
            <p className="text-gray-400">Discover goods and services available for trade.</p>
          </div>
          <button
            type="button"
            onClick={openAddItem}
            className="px-6 py-3 bg-umnotho text-dark-950 font-semibold rounded-full hover:bg-umnotho-hover transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.2)]"
          >
            <Plus className="w-5 h-5" /> List an item
          </button>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {loadError}
          </div>
        )}

        {notice && (
          <div
            className={`mb-6 flex items-start justify-between gap-4 rounded-xl border p-4 text-sm ${
              notice.tone === 'success'
                ? 'border-green-500/20 bg-green-500/10 text-green-300'
                : 'border-red-500/20 bg-red-500/10 text-red-300'
            }`}
            role="status"
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
              className="opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-dark-900 border border-white/5 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Filter by city"
              value={filters.city}
              onChange={(event) => setFilters({ ...filters, city: event.target.value })}
              aria-label="Filter listings by city"
              className="w-full bg-dark-800 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-umnotho/50"
            />
          </div>
          <select
            value={filters.type}
            onChange={(event) =>
              setFilters({ ...filters, type: event.target.value as '' | ListingType })
            }
            aria-label="Filter listings by type"
            className="bg-dark-800 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-umnotho/50"
          >
            <option value="">All types</option>
            <option value="goods">Goods</option>
            <option value="service">Services</option>
          </select>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Max value (R)"
            value={filters.maxValue}
            onChange={(event) => setFilters({ ...filters, maxValue: event.target.value })}
            aria-label="Filter listings by maximum value"
            className="bg-dark-800 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-umnotho/50 sm:w-44"
          />
        </div>

        <div className="flex gap-2 mb-8">
          <button
            type="button"
            onClick={() => setView('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'all' ? 'bg-umnotho text-dark-950' : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            All listings
          </button>
          <button
            type="button"
            onClick={() => setView('mine')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'mine' ? 'bg-umnotho text-dark-950' : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            My listings
          </button>
        </div>

        {visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-dark-900/50 p-12 text-center">
            <h2 className="text-xl font-display font-bold text-white mb-2">
              {view === 'mine' ? 'You have no listings yet' : 'Nothing matches those filters'}
            </h2>
            <p className="text-gray-400 mb-6">
              {view === 'mine'
                ? 'List something you no longer need and start trading.'
                : 'Try a different city, type, or maximum value.'}
            </p>
            <button
              type="button"
              onClick={openAddItem}
              className="px-5 py-2.5 bg-umnotho text-dark-950 font-semibold rounded-full hover:bg-umnotho-hover transition-colors"
            >
              List an item
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            <section>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
                <span className="w-2 h-8 bg-umnotho rounded-full" /> Basic bids
                <span className="text-sm font-normal text-gray-500">({basicItems.length})</span>
              </h2>
              {basicItems.length === 0 ? (
                <p className="text-gray-500">No basic listings in this view.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {basicItems.map(renderItemCard)}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
                <span className="w-2 h-8 bg-blue-500 rounded-full" /> Business bids
                <span className="text-sm font-normal text-gray-500">({businessItems.length})</span>
              </h2>
              {businessItems.length === 0 ? (
                <p className="text-gray-500">No business listings in this view.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {businessItems.map(renderItemCard)}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showAddItemModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-item-title"
              className="bg-dark-900 border border-white/10 rounded-3xl p-8 max-w-md w-full relative max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                aria-label="Close listing form"
                className="absolute top-6 right-6 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 id="add-item-title" className="text-2xl font-display font-bold text-white mb-6">
                List an item
              </h2>

              <form onSubmit={handleAddItem} className="space-y-4" noValidate>
                <div>
                  <input
                    type="text"
                    placeholder="Item name"
                    value={draft.name}
                    maxLength={80}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    aria-label="Item name"
                    className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-umnotho/50"
                  />
                  {draftErrors.name && <p className="text-xs text-red-400 mt-1">{draftErrors.name}</p>}
                </div>

                <div>
                  <textarea
                    placeholder="Describe the item or service, its condition, and what you want in return"
                    value={draft.description}
                    maxLength={1000}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    aria-label="Description"
                    className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-umnotho/50 min-h-28"
                  />
                  {draftErrors.description && (
                    <p className="text-xs text-red-400 mt-1">{draftErrors.description}</p>
                  )}
                </div>

                <div className="flex gap-4">
                  <div className="w-1/2">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Est. value (R)"
                      value={draft.estimatedValue}
                      onChange={(event) => setDraft({ ...draft, estimatedValue: event.target.value })}
                      aria-label="Estimated value in rand"
                      className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-umnotho/50"
                    />
                    {draftErrors.estimatedValue && (
                      <p className="text-xs text-red-400 mt-1">{draftErrors.estimatedValue}</p>
                    )}
                  </div>
                  <div className="w-1/2">
                    <input
                      type="text"
                      placeholder="City"
                      value={draft.city}
                      maxLength={60}
                      onChange={(event) => setDraft({ ...draft, city: event.target.value })}
                      aria-label="City"
                      className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-umnotho/50"
                    />
                    {draftErrors.city && <p className="text-xs text-red-400 mt-1">{draftErrors.city}</p>}
                  </div>
                </div>

                <div className="flex items-center justify-between bg-dark-800 border border-white/10 rounded-xl py-3 px-4">
                  <span className="text-gray-300">Business listing</span>
                  <input
                    type="checkbox"
                    checked={draft.isBusinessBid}
                    onChange={(event) => setDraft({ ...draft, isBusinessBid: event.target.checked })}
                    aria-label="Mark as a business listing"
                    className="w-5 h-5 accent-umnotho"
                  />
                </div>

                <select
                  value={draft.type}
                  onChange={(event) =>
                    setDraft({ ...draft, type: event.target.value as ListingType })
                  }
                  aria-label="Listing type"
                  className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-umnotho/50"
                >
                  <option value="goods">Goods</option>
                  <option value="service">Service</option>
                </select>

                <button
                  type="submit"
                  disabled={savingItem}
                  className="w-full py-3 mt-4 bg-umnotho text-dark-950 font-semibold rounded-xl hover:bg-umnotho-hover transition-colors disabled:opacity-60"
                >
                  {savingItem ? 'Posting…' : 'Post listing'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bidItem && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="bid-title"
              className="bg-dark-900 border border-white/10 rounded-3xl p-8 max-w-md w-full relative"
            >
              <button
                type="button"
                onClick={() => setBidItem(null)}
                aria-label="Close offer form"
                className="absolute top-6 right-6 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 id="bid-title" className="text-2xl font-display font-bold text-white mb-2">
                Make an offer
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                For <span className="text-white">{bidItem.name}</span> by {bidItem.ownerName}. Say
                what you will trade — cash, goods, a service, or a combination.
              </p>

              <form onSubmit={handlePlaceBid} className="space-y-4" noValidate>
                <textarea
                  placeholder="e.g. Two days of garden work plus R200"
                  value={offer}
                  maxLength={1000}
                  onChange={(event) => setOffer(event.target.value)}
                  aria-label="Your offer"
                  className="w-full bg-dark-800 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-umnotho/50 min-h-32"
                />
                {offerError && <p className="text-sm text-red-400">{offerError}</p>}
                <button
                  type="submit"
                  disabled={placingBid}
                  className="w-full py-3 bg-umnotho text-dark-950 font-semibold rounded-xl hover:bg-umnotho-hover transition-colors disabled:opacity-60"
                >
                  {placingBid ? 'Sending…' : 'Send offer'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
