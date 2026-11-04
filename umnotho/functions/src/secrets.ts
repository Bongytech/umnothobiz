import { defineSecret } from 'firebase-functions/params';

/** Set these with `firebase functions:secrets:set` before deploying. */
export const nowPaymentsApiKey = defineSecret('NOWPAYMENTS_API_KEY');
export const nowPaymentsIpnSecret = defineSecret('NOWPAYMENTS_IPN_SECRET');

export const cryptoSecrets = [nowPaymentsApiKey, nowPaymentsIpnSecret];
