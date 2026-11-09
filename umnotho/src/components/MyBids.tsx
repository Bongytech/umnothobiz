import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { AnimatePresence, motion } from 'motion/react';
import { Check, MessageSquare, Star, X } from 'lucide-react';
import AppNav from './AppNav';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { Bid, BidMessage, BidStatus, BidRole } from '../lib/types';
import {
  canMessage,
  canTransition,
  isOpenBid,
  roleForBid,
  statusStyles,
} from '../lib/bids';
import { formatRand, validateMessage } from '../lib/validation';
import { displayNameFor } from '../lib/user';
import { FullPageLoader } from './RouteGuards';

type Notice = { tone: 'success' | 'error'; text: string };

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function normalizeMessage(value: unknown): BidMessage {
  const data = (value ?? {}) as Record<string, unknown>;
  return {
    senderId: String(data.senderId ?? ''),
    senderName: String(data.senderName ?? 'Trader'),
    content: String(data.content ?? data.message ?? ''),
    createdAt: toDate(data.createdAt ?? data.timestamp),
  };
}

function normalizeStatus(value: unknown): BidStatus {
  if (value === 'Complete') return 'Completed';
  if (value === 'In Negotiation' || value === 'Completed' || value === 'Declined') return value;
  return 'Pending';
}

function normalizeBid(id: string, value: Record<string, unknown>): Bid {
  const rawValue = value.itemValue ?? value.estimatedValue;
  return {
    id,
    itemId: String(value.itemId ?? ''),
    itemName: String(value.itemName ?? value.name ?? 'Untitled item'),
    itemDescription: String(value.itemDescription ?? value.description ?? ''),
    itemValue: typeof rawValue === 'number' ? rawValue : Number(rawValue) || 0,
    city: String(value.city ?? ''),
    type: value.type === 'service' ? 'service' : 'goods',
    isBusinessBid: value.isBusinessBid === true,
    ownerId: String(value.ownerId ?? ''),
    ownerName: String(value.ownerName ?? 'Trader'),
    bidderId: String(value.bidderId ?? ''),
    bidderName: String(value.bidderName ?? 'Trader'),
    offer: String(value.offer ?? ''),
    status: normalizeStatus(value.status),
    messages: Array.isArray(value.messages) ? value.messages.map(normalizeMessage) : [],
    createdAt: toDate(value.createdAt),
    lastUpdated: toDate(value.lastUpdated ?? value.createdAt),
  };
}

function friendlyError(error: unknown, action: string): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') return `You do not have permission to ${action}.`;
  if (code === 'unavailable') return 'The database is unreachable. Check your connection.';
  if (code === 'failed-precondition') return 'A required Firestore index is still being built.';
  return `Could not ${action}. Please try again.`;
}

export default function MyBids() {
  const { user } = useAuth();
  const [received, setReceived] = useState<Bid[]>([]);
  const [placed, setPlaced] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [showCompleted, setShowCompleted] = useState(false);
  const [busyBidId, setBusyBidId] = useState<string | null>(null);
  const [ratingBid, setRatingBid] = useState<Bid | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [savingRating, setSavingRating] = useState(false);

  useEffect(() => {
    if (!user) return;

    const receivedQuery = query(
      collection(db, 'activeBids'),
      where('ownerId', '==', user.uid),
      limit(100),
    );
    const placedQuery = query(
      collection(db, 'activeBids'),
      where('bidderId', '==', user.uid),
      limit(100),
    );

    const sortByRecent = (bids: Bid[]) =>
      [...bids].sort(
        (a, b) => (b.lastUpdated?.getTime() ?? 0) - (a.lastUpdated?.getTime() ?? 0),
      );

    const unsubscribeReceived = onSnapshot(
      receivedQuery,
      (snapshot) => {
        setReceived(sortByRecent(snapshot.docs.map((bidDoc) => normalizeBid(bidDoc.id, bidDoc.data()))));
        setLoadError('');
        setLoading(false);
      },
      (error: unknown) => {
        console.error('Could not load received bids:', error);
        setLoadError(friendlyError(error, 'load your bids'));
        setLoading(false);
      },
    );

    const unsubscribePlaced = onSnapshot(
      placedQuery,
      (snapshot) => {
        setPlaced(sortByRecent(snapshot.docs.map((bidDoc) => normalizeBid(bidDoc.id, bidDoc.data()))));
        setLoadError('');
        setLoading(false);
      },
      (error: unknown) => {
        console.error('Could not load placed bids:', error);
        setLoadError(friendlyError(error, 'load your bids'));
        setLoading(false);
      },
    );

    return () => {
      unsubscribeReceived();
      unsubscribePlaced();
    };
  }, [user]);

  const { activeReceived, activePlaced, completed } = useMemo(() => {
    const all = [...received, ...placed];
    return {
      activeReceived: received.filter((bid) => isOpenBid(bid.status)),
      activePlaced: placed.filter((bid) => isOpenBid(bid.status)),
      completed: all
        .filter((bid) => bid.status === 'Completed' || bid.status === 'Declined')
        .sort((a, b) => (b.lastUpdated?.getTime() ?? 0) - (a.lastUpdated?.getTime() ?? 0)),
    };
  }, [received, placed]);

  const handleSendMessage = async (bid: Bid, role: BidRole) => {
    if (!user) return;
    const content = messages[bid.id] ?? '';
    const problem = validateMessage(content);
    if (problem) {
      setNotice({ tone: 'error', text: problem });
      return;
    }
    if (!canMessage(bid, user.uid, bid) || !role) return;

    setBusyBidId(bid.id);
    try {
      await updateDoc(doc(db, 'activeBids', bid.id), {
        messages: arrayUnion({
          senderId: user.uid,
          senderName: displayNameFor(user),
          content: content.trim(),
          createdAt: Timestamp.now(),
        }),
        lastUpdated: serverTimestamp(),
      });
      setMessages((current) => ({ ...current, [bid.id]: '' }));
    } catch (error) {
      console.error('Could not send message:', error);
      setNotice({ tone: 'error', text: friendlyError(error, 'send that message') });
    } finally {
      setBusyBidId(null);
    }
  };

  const handleUpdateStatus = async (bid: Bid, nextStatus: BidStatus) => {
    if (!user) return;
    const role = roleForBid(bid, user.uid);
    if (!canTransition(bid.status, nextStatus, role)) {
      setNotice({ tone: 'error', text: 'That status change is not allowed.' });
      return;
    }

    setBusyBidId(bid.id);
    try {
      await updateDoc(doc(db, 'activeBids', bid.id), {
        status: nextStatus,
        lastUpdated: serverTimestamp(),
      });
      if (nextStatus === 'Completed') {
        setRatingBid(bid);
        setRatingScore(5);
      }
      setNotice({ tone: 'success', text: `Offer marked as ${nextStatus.toLowerCase()}.` });
    } catch (error) {
      console.error('Could not update bid:', error);
      setNotice({ tone: 'error', text: friendlyError(error, 'update that offer') });
    } finally {
      setBusyBidId(null);
    }
  };

  const handleWithdraw = async (bid: Bid) => {
    if (!user) return;
    if (!window.confirm('Withdraw this offer? The owner will no longer see it.')) return;

    setBusyBidId(bid.id);
    try {
      await deleteDoc(doc(db, 'activeBids', bid.id));
      setNotice({ tone: 'success', text: 'Offer withdrawn.' });
    } catch (error) {
      console.error('Could not withdraw bid:', error);
      setNotice({ tone: 'error', text: friendlyError(error, 'withdraw that offer') });
    } finally {
      setBusyBidId(null);
    }
  };

  const handleRate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !ratingBid) return;

    const role = roleForBid(ratingBid, user.uid);
    const otherUserId = role === 'owner' ? ratingBid.bidderId : ratingBid.ownerId;
    if (!otherUserId) return;

    setSavingRating(true);
    try {
      await updateDoc(doc(db, 'users', otherUserId), {
        [`ratings.${user.uid}`]: ratingScore,
      });
      setRatingBid(null);
      setNotice({ tone: 'success', text: 'Thanks — your rating has been saved.' });
    } catch (error) {
      console.error('Could not save rating:', error);
      const code = (error as { code?: string } | null)?.code;
      setNotice({
        tone: 'error',
        text:
          code === 'permission-denied'
            ? 'You have already rated this trader, or the rating could not be saved.'
            : friendlyError(error, 'save that rating'),
      });
    } finally {
      setSavingRating(false);
    }
  };

  const renderBidCard = (bid: Bid, role: BidRole) => {
    const otherName = role === 'owner' ? bid.bidderName : bid.ownerName;
    const open = isOpenBid(bid.status);
    const canRate = bid.status === 'Completed';

    return (
      <article
        key={`${role}-${bid.id}`}
        className="bg-dark-900 border border-white/5 rounded-2xl p-6 flex flex-col h-full relative"
      >
        <div className="flex justify-between items-start gap-4 mb-3">
          <div className="min-w-0">
            <h3 className="text-xl font-display font-bold text-white mb-1 break-words">
              {bid.itemName}
            </h3>
            <p className="text-sm text-gray-400 line-clamp-2">{bid.itemDescription}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shrink-0 ${statusStyles(bid.status)}`}
          >
            {bid.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-4">
          <p>
            <span className="text-gray-500">With:</span> {otherName}
          </p>
          <p>
            <span className="text-gray-500">Value:</span>{' '}
            {bid.itemValue > 0 ? formatRand(bid.itemValue) : 'On request'}
          </p>
          <p className="col-span-2">
            <span className="text-gray-500">Your offer:</span>{' '}
            <span className="text-gray-200">{bid.offer || 'No offer text'}</span>
          </p>
        </div>

        <div className="flex-1 bg-dark-950 rounded-xl p-4 mb-4 border border-white/5 overflow-y-auto max-h-56 space-y-3">
          {bid.messages.map((message, index) => {
            const mine = message.senderId === user?.uid;
            return (
              <div key={`${message.senderId}-${index}`} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-gray-500 mb-1">{mine ? 'You' : message.senderName}</span>
                <div
                  className={`px-3 py-2 rounded-lg text-sm break-words ${
                    mine ? 'bg-umnotho text-dark-950' : 'bg-dark-800 text-gray-300'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            );
          })}
          {bid.messages.length === 0 && (
            <p className="text-gray-500 text-sm text-center mt-4">
              No messages yet. Start the conversation.
            </p>
          )}
        </div>

        {open && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Type a message…"
              value={messages[bid.id] ?? ''}
              maxLength={1000}
              onChange={(event) =>
                setMessages((current) => ({ ...current, [bid.id]: event.target.value }))
              }
              aria-label={`Message about ${bid.itemName}`}
              className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-umnotho/50"
            />
            <button
              type="button"
              onClick={() => handleSendMessage(bid, role)}
              disabled={busyBidId === bid.id}
              aria-label="Send message"
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white transition-colors disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>
        )}

        {open && (
          <div className="flex flex-wrap gap-2 mt-auto">
            {role === 'owner' ? (
              <>
                {bid.status === 'Pending' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(bid, 'In Negotiation')}
                    disabled={busyBidId === bid.id}
                    className="flex-1 py-2 bg-dark-800 hover:bg-dark-700 text-white text-sm font-medium rounded-lg transition-colors border border-white/5 disabled:opacity-50"
                  >
                    Negotiate
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(bid, 'Completed')}
                  disabled={busyBidId === bid.id}
                  className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium rounded-lg transition-colors border border-green-500/20 disabled:opacity-50"
                >
                  Complete
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(bid, 'Declined')}
                  disabled={busyBidId === bid.id}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20 mt-2 disabled:opacity-50"
                >
                  Decline offer
                </button>
              </>
            ) : (
              <div className="flex w-full flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(bid, 'Declined')}
                  disabled={busyBidId === bid.id}
                  className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20 disabled:opacity-50"
                >
                  Decline offer
                </button>
                {bid.status === 'Pending' && (
                  <button
                    type="button"
                    onClick={() => handleWithdraw(bid)}
                    disabled={busyBidId === bid.id}
                    className="flex-1 py-2 bg-dark-800 hover:bg-dark-700 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-white/10 disabled:opacity-50"
                  >
                    Withdraw offer
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {canRate && (
          <button
            type="button"
            onClick={() => {
              setRatingBid(bid);
              setRatingScore(5);
            }}
            className="mt-auto w-full py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors border border-white/10 flex items-center justify-center gap-2"
          >
            <Star className="w-4 h-4 text-umnotho" /> Rate {otherName}
          </button>
        )}
      </article>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950">
        <AppNav active="my-bids" />
        <FullPageLoader label="Loading your offers…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <AppNav active="my-bids" />

      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">My Bids</h1>
            <p className="text-gray-400">Track offers you received and offers you placed.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCompleted((value) => !value)}
            className="px-4 py-2 bg-dark-800 border border-white/10 rounded-lg text-sm text-white hover:bg-dark-700 transition-colors"
          >
            {showCompleted ? 'Hide closed offers' : 'Show closed offers'}
          </button>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {loadError}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className={`mb-6 flex items-start justify-between gap-4 rounded-xl border p-4 text-sm ${
              notice.tone === 'success'
                ? 'border-green-500/20 bg-green-500/10 text-green-300'
                : 'border-red-500/20 bg-red-500/10 text-red-300'
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-8 bg-umnotho rounded-full" /> Offers received
              <span className="text-sm font-normal text-gray-500">({activeReceived.length})</span>
            </h2>
            {activeReceived.length === 0 ? (
              <p className="text-gray-500">No open offers on your listings.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeReceived.map((bid) => renderBidCard(bid, 'owner'))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-8 bg-blue-500 rounded-full" /> Offers I placed
              <span className="text-sm font-normal text-gray-500">({activePlaced.length})</span>
            </h2>
            {activePlaced.length === 0 ? (
              <p className="text-gray-500">
                No open offers. Browse the market to make your first offer.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activePlaced.map((bid) => renderBidCard(bid, 'bidder'))}
              </div>
            )}
          </section>

          {showCompleted && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="pt-8 border-t border-white/5"
            >
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
                <span className="w-2 h-8 bg-green-500 rounded-full" /> Closed offers
                <span className="text-sm font-normal text-gray-500">({completed.length})</span>
              </h2>
              {completed.length === 0 ? (
                <p className="text-gray-500">Nothing here yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {completed.map((bid) => {
                    const role = user ? roleForBid(bid, user.uid) : null;
                    return role ? renderBidCard(bid, role) : null;
                  })}
                </div>
              )}
            </motion.section>
          )}
        </div>
      </main>

      <AnimatePresence>
        {ratingBid && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="rating-title"
              className="bg-dark-900 border border-white/10 rounded-3xl p-8 max-w-md w-full relative"
            >
              <button
                type="button"
                onClick={() => setRatingBid(null)}
                aria-label="Close rating form"
                className="absolute top-6 right-6 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 id="rating-title" className="text-2xl font-display font-bold text-white mb-2">
                Rate your trade
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                How did it go with{' '}
                {user && roleForBid(ratingBid, user.uid) === 'owner'
                  ? ratingBid.bidderName
                  : ratingBid.ownerName}
                ?
              </p>

              <form onSubmit={handleRate} className="space-y-6">
                <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      role="radio"
                      aria-checked={ratingScore === score}
                      aria-label={`${score} out of 5`}
                      onClick={() => setRatingScore(score)}
                      className="p-2 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          score <= ratingScore ? 'text-umnotho fill-umnotho' : 'text-gray-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={savingRating}
                  className="w-full py-3 bg-umnotho text-dark-950 font-semibold rounded-xl hover:bg-umnotho-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" /> {savingRating ? 'Saving…' : 'Submit rating'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
