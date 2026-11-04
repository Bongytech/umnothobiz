import { Timestamp } from 'firebase-admin/firestore';
import { db } from './admin';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_CHECKOUTS_PER_WINDOW = 5;

/**
 * Small Firestore-backed limiter. This is intentionally simple: it protects the
 * paid checkout endpoint from accidental loops and casual abuse. A public
 * launch should also use App Check and, ideally, a dedicated rate-limit layer.
 */
export async function assertCheckoutRateLimit(uid: string): Promise<void> {
  const ref = db.collection('rateLimits').doc(`${uid}_checkout`);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const now = Date.now();
    const data = snapshot.data();
    const previousStart = data?.windowStart;
    const windowStart =
      previousStart instanceof Timestamp ? previousStart.toMillis() : now;
    const previousCount = typeof data?.count === 'number' ? data.count : 0;

    if (now - windowStart >= WINDOW_MS) {
      transaction.set(
        ref,
        {
          windowStart: Timestamp.fromMillis(now),
          count: 1,
          updatedAt: Timestamp.fromMillis(now),
        },
        { merge: true },
      );
      return;
    }

    if (previousCount >= MAX_CHECKOUTS_PER_WINDOW) {
      throw new Error('rate-limited');
    }

    transaction.set(
      ref,
      {
        windowStart: Timestamp.fromMillis(windowStart),
        count: previousCount + 1,
        updatedAt: Timestamp.fromMillis(now),
      },
      { merge: true },
    );
  });
}
