import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settlePayment } from './payments';
import type { WebhookEvent } from './providers/types';

/**
 * Settlement tests without the Firestore emulator.
 *
 * `./admin` is replaced with a small in-memory Firestore that supports the
 * subset used by `settlePayment`: `collection().doc()`, `runTransaction()`,
 * `transaction.get/update/set`. Writes are applied only when the transaction
 * callback resolves, which mirrors the all-or-nothing behaviour the real code
 * relies on.
 */
const fake = vi.hoisted(() => {
  type Data = Record<string, unknown>;

  const store = new Map<string, Data>();

  const snapshot = (path: string) => ({
    exists: store.has(path),
    id: path.split('/').pop() ?? path,
    data: () => store.get(path),
  });

  const docRef = (path: string) => ({
    path,
    id: path.split('/').pop() ?? path,
    get: async () => snapshot(path),
    set: async (data: Data, options?: { merge?: boolean }) => {
      store.set(path, options?.merge ? { ...(store.get(path) ?? {}), ...data } : { ...data });
    },
    update: async (data: Data) => {
      store.set(path, { ...(store.get(path) ?? {}), ...data });
    },
  });

  const db = {
    collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }),
    runTransaction: async (run: (transaction: unknown) => Promise<unknown>) => {
      const writes: { path: string; data: Data; merge: boolean }[] = [];
      const transaction = {
        get: async (target: { path: string }) => snapshot(target.path),
        update: (target: { path: string }, data: Data) => {
          writes.push({ path: target.path, data, merge: true });
        },
        set: (target: { path: string }, data: Data, options?: { merge?: boolean }) => {
          writes.push({ path: target.path, data, merge: options?.merge === true });
        },
      };

      await run(transaction);

      for (const write of writes) {
        store.set(
          write.path,
          write.merge ? { ...(store.get(write.path) ?? {}), ...write.data } : { ...write.data },
        );
      }
    },
  };

  return { store, db };
});

vi.mock('./admin', () => ({ db: fake.db }));

const PAYMENT_ID = 'pay1';
const OWNER_ID = 'user-1';
const AMOUNT_USDT = 2.65;

function seedPayment(overrides: Record<string, unknown> = {}): void {
  fake.store.set(`payments/${PAYMENT_ID}`, {
    ownerId: OWNER_ID,
    plan: 'basic',
    planName: 'Basic',
    amountZar: 49,
    amountUsdt: AMOUNT_USDT,
    rateZarPerUsdt: 18.5,
    provider: 'nowpayments',
    providerStatus: 'waiting',
    status: 'pending',
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60_000),
    ...overrides,
  });
}

function seedUser(overrides: Record<string, unknown> = {}): void {
  fake.store.set(`users/${OWNER_ID}`, { displayName: 'Buyer', ratings: {}, ...overrides });
}

function payment(): Record<string, unknown> {
  return fake.store.get(`payments/${PAYMENT_ID}`) ?? {};
}

function user(): Record<string, unknown> {
  return fake.store.get(`users/${OWNER_ID}`) ?? {};
}

function event(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    paymentId: PAYMENT_ID,
    status: 'paid',
    providerStatus: 'finished',
    amountUsdt: AMOUNT_USDT,
    txHash: '0xabc',
    ...overrides,
  };
}

function expiryMillis(): number {
  const value = user().subscriptionExpiresAt;
  return value instanceof Timestamp ? value.toMillis() : 0;
}

beforeEach(() => {
  fake.store.clear();
});

describe('settlePayment — late and duplicate events', () => {
  it('settles a paid event that arrives after the local expiry', async () => {
    seedPayment({ expiresAt: Timestamp.fromMillis(Date.now() - 60_000) });
    seedUser();

    await settlePayment(PAYMENT_ID, event());

    expect(payment().status).toBe('paid');
    expect(payment().latePayment).toBe(true);
    expect(user().subscriptionTier).toBe('basic');
    expect(expiryMillis()).toBeGreaterThan(Date.now());
  });

  it('is idempotent for duplicate paid events', async () => {
    seedPayment();
    seedUser();

    await settlePayment(PAYMENT_ID, event());
    const firstExpiry = expiryMillis();
    const firstRenewedAt = user().subscriptionRenewedAt;

    await settlePayment(PAYMENT_ID, event());

    expect(expiryMillis()).toBe(firstExpiry);
    expect(user().subscriptionRenewedAt).toBe(firstRenewedAt);
  });

  it('extends an existing subscription instead of restarting it', async () => {
    const existing = Timestamp.fromMillis(Date.now() + 5 * 24 * 60 * 60 * 1000);
    seedPayment();
    seedUser({ subscriptionTier: 'biz', subscriptionExpiresAt: existing });

    await settlePayment(PAYMENT_ID, event());

    expect(expiryMillis()).toBe(existing.toMillis() + 30 * 24 * 60 * 60 * 1000);
  });
});

describe('settlePayment — amount handling', () => {
  it('fails a paid event that carries no usable amount', async () => {
    seedPayment();
    seedUser();

    await settlePayment(PAYMENT_ID, event({ amountUsdt: undefined }));

    expect(payment().status).toBe('failed');
    expect(user().subscriptionTier).toBeUndefined();
    expect(user().subscriptionExpiresAt).toBeUndefined();
  });

  it('rescues a payment that failed for a missing amount when a corrected event arrives', async () => {
    seedPayment();
    seedUser();

    await settlePayment(PAYMENT_ID, event({ amountUsdt: undefined }));
    expect(payment().status).toBe('failed');

    await settlePayment(PAYMENT_ID, event({ amountUsdt: AMOUNT_USDT }));

    expect(payment().status).toBe('paid');
    expect(payment().recoveredFrom).toBe('failed');
    expect(user().subscriptionTier).toBe('basic');
  });

  it('fails an underpayment and provisions nothing', async () => {
    seedPayment();
    seedUser();

    await settlePayment(PAYMENT_ID, event({ amountUsdt: 1 }));

    expect(payment().status).toBe('failed');
    expect(payment().amountReceived).toBe(1);
    expect(user().subscriptionTier).toBeUndefined();
  });

  it('accepts an overpayment and flags it for follow-up', async () => {
    seedPayment();
    seedUser();

    await settlePayment(PAYMENT_ID, event({ amountUsdt: 5 }));

    expect(payment().status).toBe('paid');
    expect(payment().overpaid).toBe(true);
    expect(user().subscriptionTier).toBe('basic');
  });

  it('treats a payment within the rounding tolerance as settled', async () => {
    seedPayment();
    seedUser();

    await settlePayment(PAYMENT_ID, event({ amountUsdt: AMOUNT_USDT - 0.02 }));

    expect(payment().status).toBe('paid');
    expect(payment().overpaid).toBe(false);
  });
});

describe('settlePayment — non-terminal events', () => {
  it('records provider progress without activating a plan', async () => {
    seedPayment();
    seedUser();

    await settlePayment(PAYMENT_ID, event({ status: 'pending', providerStatus: 'confirming' }));

    expect(payment().status).toBe('pending');
    expect(payment().providerStatus).toBe('confirming');
    expect(user().subscriptionTier).toBeUndefined();
  });

  it('leaves a failed payment failed when a non-paid event follows', async () => {
    seedPayment({ status: 'failed', providerStatus: 'amount-missing' });
    seedUser();

    await settlePayment(PAYMENT_ID, event({ status: 'expired', providerStatus: 'expired' }));

    expect(payment().status).toBe('failed');
    expect(payment().providerStatus).toBe('amount-missing');
  });

  it('rejects a payment that does not exist', async () => {
    await expect(settlePayment('missing', event())).rejects.toThrow('Payment not found');
  });

  it('rejects a malformed payment id', async () => {
    await expect(settlePayment('../etc/passwd', event())).rejects.toThrow('Invalid payment id');
  });
});
