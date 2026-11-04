import { Timestamp } from 'firebase-admin/firestore';
import { db } from './admin';
import { isExpired, paymentExpiry } from './core';
import { PLANS, isPlanId } from './plans';
import type { PlanId } from './plans';
import { getProvider, isSandbox, sandboxAllowed } from './provider';
import { assertCheckoutRateLimit } from './rateLimit';
import type { WebhookEvent } from './providers/types';

export type PaymentErrorCode =
  | 'invalid-plan'
  | 'not-found'
  | 'permission-denied'
  | 'expired'
  | 'unavailable'
  | 'rate-limited';

export class PaymentError extends Error {
  constructor(
    readonly code: PaymentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export interface CheckoutResponse {
  paymentId: string;
  plan: PlanId;
  planName: string;
  amountZar: number;
  amountUsdt: number;
  rateZarPerUsdt: number;
  provider: string;
  providerLabel: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  providerStatus: string | null;
  address: string | null;
  network: string;
  checkoutUrl: string | null;
  reference: string;
  createdAt: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  txHash: string | null;
  sandbox: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function iso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function toResponse(paymentId: string, data: Record<string, unknown>): CheckoutResponse {
  return {
    paymentId,
    plan: data.plan as PlanId,
    planName: String(data.planName ?? ''),
    amountZar: Number(data.amountZar ?? 0),
    amountUsdt: Number(data.amountUsdt ?? 0),
    rateZarPerUsdt: Number(data.rateZarPerUsdt ?? 0),
    provider: String(data.provider ?? ''),
    providerLabel: String(data.providerLabel ?? ''),
    status: data.status as CheckoutResponse['status'],
    providerStatus: typeof data.providerStatus === 'string' ? data.providerStatus : null,
    address: typeof data.address === 'string' ? data.address : null,
    network: String(data.network ?? ''),
    checkoutUrl: typeof data.checkoutUrl === 'string' ? data.checkoutUrl : null,
    reference: String(data.reference ?? paymentId),
    createdAt: iso(data.createdAt),
    expiresAt: iso(data.expiresAt),
    paidAt: iso(data.paidAt),
    txHash: typeof data.txHash === 'string' ? data.txHash : null,
    sandbox: data.provider === 'sandbox',
  };
}

function resolveProvider() {
  try {
    return getProvider();
  } catch (error) {
    throw new PaymentError(
      'unavailable',
      error instanceof Error ? error.message : 'Crypto payments are not configured.',
    );
  }
}

export async function createCheckout(ownerId: string, planId: unknown): Promise<CheckoutResponse> {
  if (!isPlanId(planId)) {
    throw new PaymentError('invalid-plan', 'Choose a valid paid plan.');
  }

  const plan = PLANS[planId];
  try {
    await assertCheckoutRateLimit(ownerId);
  } catch (error) {
    if (error instanceof Error && error.message === 'rate-limited') {
      throw new PaymentError(
        'rate-limited',
        'Too many checkout attempts. Please wait a few minutes and try again.',
      );
    }
    throw error;
  }

  const provider = resolveProvider();
  const quote = await provider.quote(plan.amountZar);
  const paymentRef = db.collection('payments').doc();
  const paymentId = paymentRef.id;
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromDate(paymentExpiry(now.toMillis(), provider.ttlMinutes));

  const session = await provider.createCheckout({
    paymentId,
    ownerId,
    plan,
    amountUsdt: quote.amountUsdt,
    rateZarPerUsdt: quote.rateZarPerUsdt,
  });

  const payment = {
    ownerId,
    plan: plan.id,
    planName: plan.name,
    amountZar: plan.amountZar,
    amountUsdt: quote.amountUsdt,
    rateZarPerUsdt: quote.rateZarPerUsdt,
    provider: session.provider,
    providerLabel: session.providerLabel,
    providerPaymentId: session.providerPaymentId,
    providerStatus: 'waiting',
    status: 'pending' as const,
    address: session.address ?? null,
    network: session.network,
    checkoutUrl: session.checkoutUrl ?? null,
    reference: paymentId,
    createdAt: now,
    updatedAt: now,
    expiresAt,
    paidAt: null,
    txHash: null,
  };

  await paymentRef.set(payment);
  return toResponse(paymentId, payment);
}

export async function getCheckout(ownerId: string, paymentId: unknown): Promise<CheckoutResponse> {
  if (typeof paymentId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(paymentId)) {
    throw new PaymentError('not-found', 'Payment not found.');
  }

  const snapshot = await db.collection('payments').doc(paymentId).get();
  if (!snapshot.exists) {
    throw new PaymentError('not-found', 'Payment not found.');
  }

  const data = snapshot.data() as Record<string, unknown>;
  if (data.ownerId !== ownerId) {
    throw new PaymentError('permission-denied', 'You cannot view this payment.');
  }

  return toResponse(snapshot.id, data);
}

/**
 * Local-only shortcut for the sandbox provider. It writes through the same
 * settlePayment path as a real webhook, so it cannot bypass plan validation.
 */
export async function confirmSandbox(ownerId: string, paymentId: unknown): Promise<CheckoutResponse> {
  if (!isSandbox() || !sandboxAllowed()) {
    throw new PaymentError(
      'unavailable',
      'Sandbox payments are disabled. Use a real provider webhook in production.',
    );
  }

  const payment = await getCheckout(ownerId, paymentId);

  if (payment.status === 'paid') return payment;
  if (payment.status !== 'pending') {
    throw new PaymentError('expired', 'This checkout is no longer payable.');
  }
  if (payment.expiresAt && isExpired(new Date(payment.expiresAt))) {
    await db.collection('payments').doc(payment.paymentId).update({
      status: 'expired',
      updatedAt: Timestamp.now(),
    });
    throw new PaymentError('expired', 'This checkout has expired.');
  }

  await settlePayment(payment.paymentId, {
    paymentId: payment.paymentId,
    status: 'paid',
    txHash: `sandbox-${payment.paymentId}`,
  });

  return getCheckout(ownerId, payment.paymentId);
}

export async function handleWebhook(event: WebhookEvent): Promise<void> {
  await settlePayment(event.paymentId, event);
}

/**
 * Idempotent payment settlement. A payment can only move from pending to a
 * terminal state once, and only a paid event activates a plan.
 */
async function settlePayment(paymentId: string, event: WebhookEvent): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(paymentId)) {
    throw new Error('Invalid payment id');
  }

  const paymentRef = db.collection('payments').doc(paymentId);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(paymentRef);
    if (!snapshot.exists) throw new Error('Payment not found');

    const data = snapshot.data() as Record<string, unknown>;
    if (data.status === 'paid') return;
    if (data.status !== 'pending') return;

    const now = Timestamp.now();
    const expiresAt = data.expiresAt;
    if (expiresAt instanceof Timestamp && expiresAt.toMillis() <= now.toMillis()) {
      transaction.update(paymentRef, { status: 'expired', updatedAt: now });
      return;
    }

    if (event.status === 'pending') {
      transaction.update(paymentRef, {
        providerStatus: event.providerStatus ?? 'pending',
        providerPaymentId: event.providerPaymentId ?? data.providerPaymentId ?? null,
        updatedAt: now,
      });
      return;
    }

    if (event.status !== 'paid') {
      transaction.update(paymentRef, {
        status: event.status,
        providerStatus: event.providerStatus ?? event.status,
        updatedAt: now,
        txHash: event.txHash ?? null,
      });
      return;
    }

    const expectedUsdt = Number(data.amountUsdt);
    if (
      typeof event.amountUsdt === 'number' &&
      Math.abs(event.amountUsdt - expectedUsdt) > Math.max(0.01, expectedUsdt * 0.02)
    ) {
      transaction.update(paymentRef, {
        status: 'failed',
        providerStatus: event.providerStatus ?? 'amount-mismatch',
        updatedAt: now,
        txHash: event.txHash ?? null,
      });
      return;
    }

    const planId = data.plan;
    if (!isPlanId(planId)) throw new Error('Payment has an unknown plan');

    const plan = PLANS[planId];
    const ownerId = data.ownerId;
    if (typeof ownerId !== 'string' || ownerId.length === 0) {
      throw new Error('Payment has no owner');
    }

    const userRef = db.collection('users').doc(ownerId);
    const userSnapshot = await transaction.get(userRef);
    const currentExpiry = userSnapshot.data()?.subscriptionExpiresAt;
    const startedAt =
      currentExpiry instanceof Timestamp && currentExpiry.toMillis() > now.toMillis()
        ? currentExpiry
        : now;
    const newExpiry = Timestamp.fromMillis(startedAt.toMillis() + plan.durationDays * DAY_MS);

    transaction.update(paymentRef, {
      status: 'paid',
      providerStatus: event.providerStatus ?? 'finished',
      providerPaymentId: event.providerPaymentId ?? data.providerPaymentId ?? null,
      paidAt: now,
      updatedAt: now,
      txHash: event.txHash ?? null,
    });

    transaction.set(
      userRef,
      {
        subscriptionTier: plan.id,
        subscriptionStatus: 'active',
        subscriptionStartedAt: now,
        subscriptionExpiresAt: newExpiry,
        lastPaymentId: paymentId,
      },
      { merge: true },
    );
  });
}
