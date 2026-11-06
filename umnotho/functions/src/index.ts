import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './admin';
import { deleteAccount } from './account';
import { getProvider } from './provider';
import type { PaymentProvider, WebhookEvent } from './providers/types';
import { cryptoSecrets } from './secrets';
import {
  PaymentError,
  confirmSandbox,
  createCheckout,
  getCheckout,
  handleWebhook,
} from './payments';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const withSecrets = {
  ...(cryptoSecrets.length > 0 ? { secrets: cryptoSecrets } : {}),
};
const callableOptions = {
  ...withSecrets,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;

  if (error instanceof PaymentError) {
    switch (error.code) {
      case 'invalid-plan':
        return new HttpsError('invalid-argument', error.message);
      case 'not-found':
        return new HttpsError('not-found', error.message);
      case 'permission-denied':
        return new HttpsError('permission-denied', error.message);
      case 'expired':
        return new HttpsError('failed-precondition', error.message);
      case 'unavailable':
        return new HttpsError('failed-precondition', error.message);
      case 'rate-limited':
        return new HttpsError('resource-exhausted', error.message);
    }
  }

  console.error('Crypto checkout failed:', error);
  return new HttpsError('internal', 'Crypto checkout failed.');
}

export const createCryptoCheckout = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before starting a crypto checkout.');
  }

  if (process.env.REQUIRE_VERIFIED_EMAIL === 'true' && request.auth.token.email_verified !== true) {
    throw new HttpsError(
      'failed-precondition',
      'Verify your email address before starting a crypto checkout.',
    );
  }

  const data = request.data as { plan?: unknown } | undefined;
  try {
    return await createCheckout(request.auth.uid, data?.plan);
  } catch (error) {
    throw toHttpsError(error);
  }
});

export const getCryptoCheckout = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to view this payment.');
  }

  const data = request.data as { paymentId?: unknown } | undefined;
  try {
    return await getCheckout(request.auth.uid, data?.paymentId);
  } catch (error) {
    throw toHttpsError(error);
  }
});

/**
 * Account deletion. Requires a recent sign-in so a stolen session cannot erase
 * the account silently. Auth is deleted last; trade records are anonymised.
 */
export const deleteMyAccount = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before deleting your account.');
  }

  try {
    return await deleteAccount(request.auth.uid, request.auth.token.auth_time);
  } catch (error) {
    if (error instanceof Error && error.message === 'reauth-required') {
      throw new HttpsError(
        'failed-precondition',
        'Sign in again in the last 15 minutes before deleting your account.',
      );
    }
    console.error('Account deletion failed:', error);
    throw new HttpsError('internal', 'Could not delete the account. Contact support.');
  }
});

export const confirmSandboxPayment = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to confirm this payment.');
  }

  const data = request.data as { paymentId?: unknown } | undefined;
  try {
    return await confirmSandbox(request.auth.uid, data?.paymentId);
  } catch (error) {
    throw toHttpsError(error);
  }
});

/**
 * Provider webhook endpoint. Real providers must verify their signature in
 * their adapter; the sandbox adapter uses an HMAC of the raw body.
 */
export const cryptoWebhook = onRequest(withSecrets, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  let provider: PaymentProvider;
  try {
    provider = getProvider();
  } catch (error) {
    console.error('Crypto webhook provider is unavailable:', error);
    response.status(503).json({ ok: false, error: 'Payment provider unavailable' });
    return;
  }

  const rawBody =
    (request as typeof request & { rawBody?: Buffer }).rawBody ??
    Buffer.from(JSON.stringify(request.body ?? {}));
  const signature =
    request.header('x-nowpayments-sig') ?? request.header('x-crypto-signature') ?? '';

  let event: WebhookEvent;
  try {
    event = provider.parseWebhook(rawBody, signature);
  } catch (error) {
    console.error('Crypto webhook rejected:', error);
    response.status(400).json({ ok: false, error: 'Invalid webhook' });
    return;
  }

  try {
    await handleWebhook(event);
    response.status(200).json({ ok: true });
  } catch (error) {
    // A transient Firestore/provider failure must be retried by the provider.
    console.error('Crypto settlement failed:', error);
    response.status(500).json({ ok: false, error: 'Settlement failed' });
  }
});

/**
 * Hourly safety net for missed webhooks and abandoned checkouts.
 *
 * - Reconciles pending payments older than an hour against the provider.
 * - Marks checkouts expired only after a grace period, in a transaction that
 *   re-checks the current status so a paid webhook is never overwritten.
 */
export const reconcileCryptoPayments = onSchedule(
  { schedule: 'every 60 minutes', secrets: cryptoSecrets },
  async () => {
    let provider: PaymentProvider | null = null;
    try {
      provider = getProvider();
    } catch (error) {
      console.error('Crypto reconciliation has no provider:', error);
    }

    const snapshot = await db
      .collection('payments')
      .where('status', 'in', ['pending', 'failed'])
      .limit(100)
      .get();
    const now = Date.now();
    const hour = 60 * 60 * 1000;

    for (const payment of snapshot.docs) {
      const data = payment.data();
      const createdAt = data.createdAt;
      const providerPaymentId = data.providerPaymentId;

      if (
        provider?.fetchPaymentStatus &&
        typeof providerPaymentId === 'string' &&
        providerPaymentId.length > 0 &&
        createdAt instanceof Timestamp &&
        createdAt.toMillis() < now - hour
      ) {
        try {
          const event = await provider.fetchPaymentStatus(providerPaymentId, payment.id);
          if (event) {
            await handleWebhook(event);
            console.log('Reconciled payment', payment.id, event.providerStatus ?? event.status);
          }
        } catch (error) {
          console.error('Could not reconcile payment', payment.id, error);
        }
      }

      await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(payment.ref);
        if (!fresh.exists) return;
        const freshData = fresh.data();
        if (!freshData) return;
        const expiresAt = freshData.expiresAt;
        if (
          freshData.status === 'pending' &&
          expiresAt instanceof Timestamp &&
          expiresAt.toMillis() < now - hour
        ) {
          transaction.update(payment.ref, {
            status: 'expired',
            providerStatus: freshData.providerStatus ?? 'expired',
            updatedAt: Timestamp.now(),
          });
        }
      });
    }
  },
);
