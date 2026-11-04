import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './admin';
import { getProvider } from './provider';
import { cryptoSecrets } from './secrets';
import {
  PaymentError,
  confirmSandbox,
  createCheckout,
  getCheckout,
  handleWebhook,
} from './payments';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const withSecrets = { secrets: cryptoSecrets };
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

  try {
    const provider = getProvider();
    const rawBody =
      (request as typeof request & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(request.body ?? {}));
    const signature =
      request.header('x-nowpayments-sig') ?? request.header('x-crypto-signature') ?? '';
    const event = provider.parseWebhook(rawBody, signature);

    await handleWebhook(event);
    response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Crypto webhook rejected:', error);
    response.status(400).json({ ok: false, error: 'Invalid webhook' });
  }
});

/**
 * Safety net for forgotten checkouts. A payment stops being payable at its
 * expiry, but marking it explicitly keeps the UI and reconciliation clear.
 */
export const expireStalePayments = onSchedule('every 60 minutes', async () => {
  const snapshot = await db.collection('payments').where('status', '==', 'pending').limit(500).get();
  const now = Date.now();
  const batch = db.batch();
  let count = 0;

  for (const payment of snapshot.docs) {
    const expiresAt = payment.data().expiresAt;
    if (expiresAt instanceof Timestamp && expiresAt.toMillis() <= now) {
      batch.update(payment.ref, { status: 'expired', updatedAt: Timestamp.now() });
      count += 1;
      if (count >= 450) break;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Expired ${count} stale crypto checkout(s).`);
  }
});
