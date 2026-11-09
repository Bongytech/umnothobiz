import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Calendar, Crown, Mail, Package, Star, Trash2, UserRound } from 'lucide-react';
import AppNav from './AppNav';
import { useAuth } from '../contexts/AuthContext';
import { db, functions } from '../lib/firebase';
import { FullPageLoader } from './RouteGuards';

interface ProfileData {
  displayName: string;
  email: string;
  ratings: Record<string, number>;
  createdAt: Date | null;
  subscriptionTier: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: Date | null;
}

function toDate(value: unknown): Date | null {
  const timestamp = value as { toDate?: () => Date } | null;
  return timestamp && typeof timestamp.toDate === 'function' ? timestamp.toDate() : null;
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Freemium',
  basic: 'Basic',
  biz: 'Biz',
};

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [listingCount, setListingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!user) return;

    const unsubscribeProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const data = snapshot.data() ?? {};
        setProfile({
          displayName: String(data.displayName ?? user.displayName ?? 'Trader'),
          email: String(data.email ?? user.email ?? ''),
          ratings:
            data.ratings && typeof data.ratings === 'object'
              ? (data.ratings as Record<string, number>)
              : {},
          createdAt: toDate(data.createdAt),
          subscriptionTier: String(data.subscriptionTier ?? 'free'),
          subscriptionStatus: String(data.subscriptionStatus ?? 'inactive'),
          subscriptionExpiresAt: toDate(data.subscriptionExpiresAt),
        });
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Could not load profile:', snapshotError);
        setError('Could not load your profile.');
        setLoading(false);
      },
    );

    const unsubscribeListings = onSnapshot(
      query(collection(db, 'barterItems'), where('ownerId', '==', user.uid)),
      (snapshot) => setListingCount(snapshot.size),
      (snapshotError) => {
        console.error('Could not load listing count:', snapshotError);
      },
    );

    return () => {
      unsubscribeProfile();
      unsubscribeListings();
    };
  }, [user]);

  const rating = useMemo(() => {
    const values = Object.values(profile?.ratings ?? {}).filter(
      (value) => typeof value === 'number' && value >= 1 && value <= 5,
    );
    if (values.length === 0) return null;
    return {
      average: values.reduce((total, value) => total + value, 0) / values.length,
      count: values.length,
    };
  }, [profile?.ratings]);

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your account? Your listings, bids and profile will be removed.')) {
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await httpsCallable(functions, 'deleteMyAccount')();
      await logout();
      navigate('/');
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof Error
          ? deleteFailure.message
          : 'Could not delete the account. Contact support.',
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950">
        <AppNav active="profile" />
        <FullPageLoader label="Loading your profile…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <AppNav active="profile" />

      <main className="flex-1 p-6 md:p-12 max-w-4xl mx-auto w-full">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Your profile</h1>
        <p className="text-gray-400 mb-8">How other traders see you in the market.</p>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-dark-900 p-8">
            <div className="w-16 h-16 rounded-full bg-umnotho text-dark-950 flex items-center justify-center mb-6">
              <UserRound className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-1">
              {profile?.displayName || 'Trader'}
            </h2>
            <p className="text-sm text-gray-400 flex items-center gap-2 mb-6">
              <Mail className="w-4 h-4" /> {profile?.email || user?.email}
            </p>
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {profile?.createdAt
                ? `Member since ${profile.createdAt.toLocaleDateString()}`
                : 'New member'}
            </p>
          </section>

          <section className="rounded-3xl border border-white/10 bg-dark-900 p-8 flex flex-col justify-center">
            <p className="text-sm uppercase tracking-wider text-gray-500 mb-3">Trader rating</p>
            {rating ? (
              <>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-5xl font-display font-bold text-white">
                    {rating.average.toFixed(1)}
                  </span>
                  <span className="text-gray-400 mb-1">/ 5</span>
                </div>
                <div className="flex items-center gap-1 mb-2" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <Star
                      key={score}
                      className={`w-5 h-5 ${
                        score <= Math.round(rating.average)
                          ? 'text-umnotho fill-umnotho'
                          : 'text-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-400">
                  Based on {rating.count} rating{rating.count === 1 ? '' : 's'}
                </p>
              </>
            ) : (
              <p className="text-gray-400">
                No ratings yet. Complete a trade and your partner can rate you.
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-dark-900 p-8 md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-umnotho/10 text-umnotho flex items-center justify-center shrink-0">
              <Crown className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Current plan</p>
              <p className="text-xl font-display font-bold text-white">
                {PLAN_NAMES[profile?.subscriptionTier ?? 'free'] ?? 'Freemium'}
              </p>
              <p className="text-sm text-gray-400">
                {profile?.subscriptionTier && profile.subscriptionTier !== 'free'
                  ? `Status: ${profile.subscriptionStatus}${
                      profile.subscriptionExpiresAt
                        ? ` · renews/expires ${profile.subscriptionExpiresAt.toLocaleDateString()}`
                        : ''
                    }`
                  : 'Free plan — upgrade to unlock unlimited trades.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/pricing')}
              className="rounded-xl border border-umnotho/30 bg-umnotho/10 px-4 py-2.5 text-sm font-semibold text-umnotho hover:bg-umnotho/20"
            >
              {profile?.subscriptionTier && profile.subscriptionTier !== 'free'
                ? 'Extend plan'
                : 'Upgrade'}
            </button>
          </section>

          <section className="rounded-3xl border border-white/10 bg-dark-900 p-8 md:col-span-2 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-umnotho/10 text-umnotho flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-white">{listingCount}</p>
              <p className="text-sm text-gray-400">
                Active listing{listingCount === 1 ? '' : 's'} in the exchange market
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 md:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display font-bold text-white">Delete account</p>
                <p className="text-sm text-gray-400">
                  Removes your profile and listings, and anonymises trade records. Payment records
                  are kept for tax and fraud prevention.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
            {deleteError && <p className="mt-3 text-sm text-red-300">{deleteError}</p>}
          </section>
        </div>
      </main>
    </div>
  );
}
