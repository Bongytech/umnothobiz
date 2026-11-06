import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentReference } from 'firebase-admin/firestore';
import { db } from './admin';

const MAX_WRITES_PER_BATCH = 400;

interface AccountDeletionResult {
  deleted: boolean;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function commitUpdates(
  updates: { ref: DocumentReference; data: Record<string, unknown> }[],
): Promise<void> {
  for (const group of chunks(updates, MAX_WRITES_PER_BATCH)) {
    const batch = db.batch();
    for (const update of group) {
      batch.update(update.ref, update.data as never);
    }
    await batch.commit();
  }
}

/**
 * Deletes the caller's Auth account and profile, and anonymises content that
 * other users may still have in their trade history. Payment records are kept
 * (pseudonymously) for tax/fraud retention; see the privacy notice.
 *
 * Requires a recent sign-in: callers must have authenticated within 15 minutes.
 */
export async function deleteAccount(
  uid: string,
  authTimeSeconds: number | undefined,
): Promise<AccountDeletionResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!authTimeSeconds || nowSeconds - authTimeSeconds > 15 * 60) {
    throw new Error('reauth-required');
  }

  const [listings, bidsAsBidder, bidsAsOwner] = await Promise.all([
    db.collection('barterItems').where('ownerId', '==', uid).limit(500).get(),
    db.collection('activeBids').where('bidderId', '==', uid).limit(500).get(),
    db.collection('activeBids').where('ownerId', '==', uid).limit(500).get(),
  ]);

  const bidUpdates = new Map<
    string,
    { ref: DocumentReference; data: Record<string, unknown> }
  >();
  for (const doc of [...bidsAsBidder.docs, ...bidsAsOwner.docs]) {
    bidUpdates.set(doc.ref.path, {
      ref: doc.ref,
      data: {
        ownerName: 'Deleted user',
        bidderName: 'Deleted user',
        offer: 'Offer removed',
        messages: [],
        anonymised: true,
        updatedAt: Timestamp.now(),
      },
    });
  }

  await commitUpdates([
    ...listings.docs.map((doc) => ({
      ref: doc.ref,
      data: {
        ownerName: 'Deleted user',
        name: 'Removed listing',
        description: 'This listing was removed because the account was deleted.',
        city: '',
        inquiries: [],
        votes: {},
        anonymised: true,
        updatedAt: Timestamp.now(),
      },
    })),
    ...Array.from(bidUpdates.values()),
  ]);

  const userRef = db.collection('users').doc(uid);
  const rateLimitRef = db.collection('rateLimits').doc(`${uid}_checkout`);
  const batch = db.batch();
  batch.delete(userRef);
  batch.delete(rateLimitRef);
  await batch.commit();

  // Delete Auth last. If this fails, the profile is already gone and the
  // operation can be retried; the user cannot be left with an active profile.
  await getAuth().deleteUser(uid);

  return { deleted: true };
}
