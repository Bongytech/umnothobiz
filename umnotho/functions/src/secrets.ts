import { defineSecret } from 'firebase-functions/params';

/**
 * Secret Manager is optional.
 *
 * Set USE_SECRET_MANAGER=true to bind NOWPAYMENTS_API_KEY and
 * NOWPAYMENTS_IPN_SECRET from Google Secret Manager. Leave it false/unset to use
 * Firebase Functions environment variables instead (free, but less isolated).
 *
 * Defining the secrets only when enabled keeps `firebase deploy` from touching
 * the Secret Manager API when it is disabled or not wanted.
 */
export const secretManagerEnabled = process.env.USE_SECRET_MANAGER === 'true';

export const cryptoSecrets = secretManagerEnabled
  ? [
      defineSecret('NOWPAYMENTS_API_KEY'),
      defineSecret('NOWPAYMENTS_IPN_SECRET'),
    ]
  : [];
