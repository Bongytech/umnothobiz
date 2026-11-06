# Crypto payments

Umnotho prices paid plans in **ZAR** and settles them in **USDT** through a
provider-agnostic hosted checkout. Phase 1 is implemented with a local sandbox and
a **NOWPayments** live adapter.

> **Live mode needs configuration.** The repository contains no provider keys or
> webhook secrets. Until `CRYPTO_PROVIDER=nowpayments`, the NOWPayments secrets,
> and a public webhook URL are configured, checkout falls back to the local
> sandbox or reports that crypto is unavailable.

---

## Phased plan

| Phase | Scope | Status |
| :--- | :--- | :--- |
| 1 | Crypto payment for Basic/Biz subscriptions, server-verified activation | Implemented: sandbox + NOWPayments |
| 2 | Crypto top-ups/differences attached to barter offers | Not started |
| 3 | On-chain escrow for trades | Not started; requires legal/security design |

Phase 1 is deliberately isolated from barter trades. A failed payment can never
change a listing, bid, or rating.

## Architecture

```text
Pricing page
   │  1. createCryptoCheckout({ plan })
   ▼
Cloud Function ── validates plan + price server-side
   │  2. creates payments/{id} with locked ZAR/USDT quote
   │  3. asks the provider adapter for an address or hosted checkout URL
   ▼
Provider checkout (NOWPayments hosted invoice, or sandbox)
   │  4. user pays USDT
   ▼
Webhook ── verifies provider signature
   │  5. idempotent transaction: payments/{id} pending → paid
   │  6. users/{uid}.subscriptionTier / subscriptionExpiresAt written by Admin SDK
   ▼
Profile / Pricing show the active plan
```

The browser never writes `subscriptionTier`, `payments.status`, or a paid amount.

## Collections

`payments/{paymentId}`:

| Field | Meaning |
| :--- | :--- |
| `ownerId` | Firebase Auth UID that started checkout |
| `plan` | `basic` or `biz` |
| `amountZar` | Server-side plan price |
| `amountUsdt` | Locked quote from the provider estimate, rounded up to 2 decimals |
| `rateZarPerUsdt` | Quote used for display |
| `provider`, `providerLabel`, `providerPaymentId` | Provider metadata |
| `providerStatus` | Latest provider status (`waiting`, `confirming`, `finished`, …) |
| `status` | `pending`, `paid`, `failed`, `expired` |
| `address`, `network`, `checkoutUrl` | Payment destination |
| `reference` | Public payment reference |
| `createdAt`, `expiresAt`, `paidAt`, `updatedAt` | Timestamps |
| `txHash` | Transaction hash / sandbox marker |

`users/{uid}` gains:

- `subscriptionTier`: `basic` or `biz`
- `subscriptionStatus`: `active`
- `subscriptionStartedAt`, `subscriptionExpiresAt`
- `lastPaymentId`

These fields are written only by the Admin SDK inside `settlePayment()`.

## Cloud Functions

| Function | Type | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `createCryptoCheckout` | Callable | Required | Validate plan, rate-limit, quote USDT, create payment |
| `getCryptoCheckout` | Callable | Required | Owner-only status polling |
| `confirmSandboxPayment` | Callable | Required | Local-only simulation through the same settlement path |
| `cryptoWebhook` | HTTPS | Provider signature | Verify and settle a real payment |
| `reconcileCryptoPayments` | Scheduled | Cloud Scheduler | Reconcile missed webhooks and expire abandoned checkouts |
| `deleteMyAccount` | Callable | Required + recent sign-in | Delete profile/Auth and anonymise trade history |

Rate limiting: five checkout creations per UID per 15 minutes (`rateLimits`
collection, Admin SDK only).

### Sandbox safety

- `getProvider()` defaults to `sandbox` only when `FUNCTIONS_EMULATOR=true`.
- `confirmSandboxPayment` refuses unless `isSandbox()` **and**
  (`FUNCTIONS_EMULATOR=true` or `ALLOW_SANDBOX_PAYMENTS=true`).
- A deployed function with no `CRYPTO_PROVIDER` returns
  `failed-precondition`; it never falls back to a fake paid state.
- `ALLOW_SANDBOX_PAYMENTS` must remain `false`/unset in production.

## Local sandbox

```bash
npm run functions:install
npm run setup:env -- --emulator --force
npm run emulators       # auth, Firestore, Functions; requires Java
# another terminal
npm run dev
```

Optional Functions environment variables (`functions/.env.local`, ignored by git):

```env
CRYPTO_PROVIDER=sandbox
ALLOW_SANDBOX_PAYMENTS=true
SANDBOX_ZAR_PER_USDT=18.50
SANDBOX_USDT_ADDRESS=0x0000000000000000000000000000000000000000
SANDBOX_NETWORK=Base Sepolia testnet
SANDBOX_WEBHOOK_SECRET=local-only-change-me
```

The callable sandbox confirmation does not need the webhook secret; the
`cryptoWebhook` function does. `FUNCTIONS_EMULATOR=true` is set automatically by
the emulator. For emulator-only secrets, create `functions/.secret.local` with
dummy values (ignored by git).

## Live NOWPayments setup

1. Create a NOWPayments account, wallet, API key, and IPN secret.
2. Provide the two credentials using **one** of these options:

   **A. Secret Manager (recommended, free tier available).** Enable the API
   first if Firebase reports it is disabled, then set the secrets:

   ```bash
   gcloud services enable secretmanager.googleapis.com
   firebase functions:secrets:set NOWPAYMENTS_API_KEY
   firebase functions:secrets:set NOWPAYMENTS_IPN_SECRET
   ```

   Set `USE_SECRET_MANAGER=true` in the Functions environment.

   **B. Environment-variable fallback.** Leave `USE_SECRET_MANAGER` unset or
   `false`, and put `NOWPAYMENTS_API_KEY` / `NOWPAYMENTS_IPN_SECRET` in
   `functions/.env.<project-id>` (or the Firebase console). The file is ignored
   by git. Use this for local/staging only: the deployed production provider
   refuses to start without Secret Manager.

3. Set non-secret Functions environment values in `functions/.env.<project-id>`
   (or the Firebase console):

   ```env
   CRYPTO_PROVIDER=nowpayments
   NOWPAYMENTS_API_URL=https://api.nowpayments.io/v1
   NOWPAYMENTS_PAY_CURRENCY=usdttrc20
   CRYPTO_WEBHOOK_URL=https://us-central1-umnotho-f71ba.cloudfunctions.net/cryptoWebhook
   APP_URL=https://umnothobiz.web.app
   REQUIRE_VERIFIED_EMAIL=true
   ENFORCE_APP_CHECK=true
   ```

   Replace the webhook/project/domain values with the real ones. The webhook URL
   must be the deployed Cloud Functions URL, not localhost.

4. Add `VITE_RECAPTCHA_SITE_KEY` to the frontend build if `ENFORCE_APP_CHECK=true`.
5. Register the webhook URL in NOWPayments and allow their IPs if you use a firewall.
6. Test with the smallest plan on a low-value invoice before inviting beta users.

`createCryptoCheckout` calls NOWPayments `/v1/estimate` for a ZAR→USDT quote, then
`/v1/invoice` with `price_currency=zar`, `pay_currency=usdttrc20`,
`is_fixed_rate=true`, and the public webhook URL. The browser only receives the
hosted invoice URL and quote.

The IPN handler verifies `x-nowpayments-sig`, maps `finished` to paid, keeps
`partially_paid`/confirmation statuses pending, and rejects an amount more than 2%
below the quote. It is idempotent and safe against duplicate IPNs.

A verified `paid` event is authoritative even when it arrives after the local
expiry, or after an earlier event was rejected for a missing amount: the payment
is settled and marked `latePayment` / `recoveredFrom`. Overpayments settle and are
flagged `overpaid` for follow-up; underpayments and amount-less events are marked
`failed` and stay visible to the hourly reconciliation job, which re-checks
`pending` and `failed` payments against the provider.

## Integrating another provider

Implement `functions/src/providers/types.ts`:

```ts
export interface PaymentProvider {
  id: string;
  label: string;
  sandbox: boolean;
  ttlMinutes: number;
  quote(amountZar: number): Promise<Quote>;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  parseWebhook(rawBody: Buffer | string, signature: string): WebhookEvent;
}
```

Then:

1. Add `functions/src/providers/<provider>.ts`.
2. Return `checkoutUrl` for hosted checkout, or `address` + `network` for a
   direct transfer.
3. Verify the provider's signature over the **raw body**.
4. Include `amountUsdt` (and ideally asset/network) in `WebhookEvent`; the
   settlement transaction marks a mismatched amount as `failed`.
5. Map the provider's paid event to `status: 'paid'`; make retries idempotent.
6. Register the adapter in `functions/src/provider.ts`.
7. Set `CRYPTO_PROVIDER` in Firebase Functions config/secrets.
8. Configure the provider webhook URL:
   `https://<region>-<project>.cloudfunctions.net/cryptoWebhook`.

Never trust a browser-supplied price, amount, plan, or “paid” flag.

## Security requirements

- No private keys, seed phrases, service-account JSON, or webhook secrets in git.
- The Firebase **web** config is public; access is enforced by Auth and rules.
- Keep `payments` writes Admin-SDK-only (see `firestore.rules`).
- Use a provider that signs webhooks; verify the raw body and timestamp.
- Validate the paid amount and asset/network before activating a plan.
- Keep the plan catalogue server-side (`functions/src/plans.ts`).
- Treat `ALLOW_SANDBOX_PAYMENTS=true` as local-only.
- App Check enforcement (`ENFORCE_APP_CHECK=true`) and checkout rate limiting are
  implemented; configure the reCAPTCHA site key and verify tokens in production.
- Verify email before payment when `REQUIRE_VERIFIED_EMAIL=true`.
- Add refunds, reconciliation, accounting, and support processes before charging.
- The repository is public: never commit `.env`, `.secret.local`, service-account
  JSON, provider keys, or webhook secrets.

## Compliance (not legal advice)

Accepting crypto for services in South Africa can engage FSCA crypto-asset
service-provider rules, tax/VAT reporting, and AML/KYC obligations depending on
how the service is structured. A regulated hosted provider can carry much of the
KYC/AML burden, but it does not remove your accounting and disclosure duties.
Confirm the model with a qualified adviser before going live.

## Tests

```bash
npm run functions:test    # plan maths, quote, NOWPayments signature/status
npm run test:rules        # payment read/write rules
npm test                  # client formatting
```

The rules tests cover:

- owner can read their payment;
- another user cannot;
- no client can create, update, or delete a payment.

The Functions tests cover:

- ZAR→USDT quote rounding;
- NOWPayments HMAC-SHA512 IPN verification;
- status mapping (`finished` only counts as paid);
- estimate + invoice request shape (mocked HTTP).
