import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import './admin';
import { getProvider } from './provider';
import {
  PaymentError,
  confirmSandbox,
  createCheckout,
  getCheckout,
  handleWebhook,
} from './payments';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

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
    }
  }

  console.error('Crypto checkout failed:', error);
  return new HttpsError('internal', 'Crypto checkout failed.');
}

export const createCryptoCheckout = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before starting a crypto checkout.');
  }

  const data = request.data as { plan?: unknown } | undefined;
  try {
    return await createCheckout(request.auth.uid, data?.plan);
  } catch (error) {
    throw toHttpsError(error);
  }
});

export const getCryptoCheckout = onCall(async (request) => {
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

export const confirmSandboxPayment = onCall(async (request) => {
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
export const cryptoWebhook = onRequest(async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const provider = getProvider();
    const rawBody =
      (request as typeof request & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(request.body ?? {}));
    const signature = request.header('x-crypto-signature') ?? '';
    const event = provider.parseWebhook(rawBody, signature);

    await handleWebhook(event);
    response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Crypto webhook rejected:', error);
    response.status(400).json({ ok: false, error: 'Invalid webhook' });
  }
});
