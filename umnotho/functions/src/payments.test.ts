import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { settlePayment } from './payments';
import { PLANS } from './plans';

type Store = Map<string, Record<string, unknown>>;

interface FakeDocRef {
  path: string;
  id: string;
}

function fakeDb(seed: Record<string, Record<string, unknown>>): {
  db: Firestore;
  store: Store;
} {
  const store: Store = new Map(Object.entries(seed));

  const docRef = (path: string): FakeDocRef => ({
    path,
    id: path.split('/').pop() ?? path,
  });

  const transaction = {
    async get(ref: FakeDocRef) {
      const data = store.get(ref.path);
      return {
        exists: data !== undefined,
        id: ref.id,
        data: () => data,
      };
    },
    update(ref: FakeDocRef, data: Record<string, unknown>) {
      store.set(ref.path, { ...store.get(ref.path), ...data });
    },
    set(ref: FakeDocRef, data: Record<string, unknown>, options?: { merge?: boolean }) {
      const current = options?.merge ? store.get(ref.path) ?? {} : {};
      store.set(ref.path, { ...current, ...data });
    },
  };

  const db = {
    collection(name: string) {
      return {
        doc(id: string) {
          return docRef(`${name}/${id}`);
        },
      };
    },
    async runTransaction<T>(callback: (tx: typeof transaction) => Promise<T>): Promise<T> {
      return callback(transaction);
    },
  };

  return { db: db as unknown as Firestore, store };
}

function payment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownerId: 'user1',
    plan: 'basic',
    amountUsdt: 2.65,
    status: 'pending',
    expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    providerPaymentId: 'provider1',
    ...overrides,
  };
}

describe('settlePayment', () => {
  it('settles a paid event that arrives after local expiry', async () => {
    const { db, store } = fakeDb({
      'payments/p1': payment({
        status: 'expired',
        expiresAt: Timestamp.fromMillis(Date.now() - 60_000),
      }),
      'users/user1': {},
    });

    await settlePayment(
      'p1',
      { paymentId: 'p1', status: 'paid', providerStatus: 'finished', amountUsdt: 2.65 },
      db,
    );

    expect(store.get('payments/p1')).toMatchObject({
      status: 'paid',
      latePayment: true,
      recoveredFrom: 'expired',
      amountReceived: 2.65,
    });
    expect(store.get('users/user1')?.subscriptionStatus).toBe('active');
  });

  it('does not extend a plan twice for a duplicate paid event', async () => {
    const { db, store } = fakeDb({
      'payments/p1': payment(),
      'users/user1': {},
    });
    const event = {
      paymentId: 'p1',
      status: 'paid' as const,
      providerStatus: 'finished',
      amountUsdt: 2.65,
    };

    await settlePayment('p1', event, db);
    const firstExpiry = store.get('users/user1')?.subscriptionExpiresAt;
    await settlePayment('p1', event, db);

    expect(store.get('payments/p1')?.status).toBe('paid');
    expect(store.get('users/user1')?.subscriptionExpiresAt).toEqual(firstExpiry);
  });

  it('fails closed when the paid amount is missing, then recovers on correction', async () => {
    const { db, store } = fakeDb({
      'payments/p1': payment(),
      'users/user1': {},
    });

    await settlePayment('p1', { paymentId: 'p1', status: 'paid' }, db);
    expect(store.get('payments/p1')).toMatchObject({
      status: 'failed',
      providerStatus: 'amount-missing',
    });

    await settlePayment(
      'p1',
      { paymentId: 'p1', status: 'paid', providerStatus: 'finished', amountUsdt: 2.65 },
      db,
    );
    expect(store.get('payments/p1')?.status).toBe('paid');
    expect(store.get('payments/p1')?.recoveredFrom).toBe('failed');
    expect(store.get('users/user1')?.subscriptionStatus).toBe('active');
  });

  it('rejects underpayment and accepts overpayment with a flag', async () => {
    const under = fakeDb({
      'payments/under': payment(),
      'users/user1': {},
    });
    await settlePayment(
      'under',
      { paymentId: 'under', status: 'paid', amountUsdt: 1 },
      under.db,
    );
    expect(under.store.get('payments/under')).toMatchObject({
      status: 'failed',
      amountReceived: 1,
    });

    const over = fakeDb({
      'payments/over': payment(),
      'users/user1': {},
    });
    await settlePayment(
      'over',
      { paymentId: 'over', status: 'paid', amountUsdt: 3 },
      over.db,
    );
    expect(over.store.get('payments/over')).toMatchObject({
      status: 'paid',
      overpaid: true,
      amountReceived: 3,
    });
  });

  it('extends an existing subscription from its current expiry', async () => {
    const existingExpiry = Timestamp.fromMillis(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const { db, store } = fakeDb({
      'payments/p1': payment(),
      'users/user1': { subscriptionExpiresAt: existingExpiry },
    });

    await settlePayment(
      'p1',
      { paymentId: 'p1', status: 'paid', amountUsdt: 2.65 },
      db,
    );

    const newExpiry = store.get('users/user1')?.subscriptionExpiresAt as Timestamp;
    expect(newExpiry.toMillis()).toBe(
      existingExpiry.toMillis() + PLANS.basic.durationDays * 24 * 60 * 60 * 1000,
    );
  });

  it('does not flag an amount inside the rounding tolerance as overpaid', async () => {
    const { db, store } = fakeDb({
      'payments/p1': payment(),
      'users/user1': {},
    });

    await settlePayment(
      'p1',
      { paymentId: 'p1', status: 'paid', amountUsdt: 2.7 },
      db,
    );

    expect(store.get('payments/p1')).toMatchObject({
      status: 'paid',
      overpaid: false,
    });
  });

  it('does not turn a failed payment into expired on a later non-paid event', async () => {
    const { db, store } = fakeDb({
      'payments/p1': payment({ status: 'failed', amountReceived: 1 }),
      'users/user1': {},
    });

    await settlePayment('p1', { paymentId: 'p1', status: 'pending' }, db);

    expect(store.get('payments/p1')?.status).toBe('failed');
  });
});
