# Crypto payments

Umnotho prices paid plans in **ZAR** and settles them in **USDT** through a
provider-agnostic hosted checkout. This document describes the current sandbox
implementation and what must change before accepting real money.

> **Current status: sandbox only.** The checkout uses a test address and can only
> be confirmed by the local Functions emulator. No provider credentials are in
> this repository and no real funds should be sent.

---

## Phased plan

| Phase | Scope | Status |
| :--- | :--- | :--- |
| 1 | Crypto payment for Basic/Biz subscriptions, server-verified activation | Implemented in sandbox |
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
Provider checkout (sandbox now, hosted provider later)
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
| `amountUsdt` | Locked quote, rounded up to 2 decimals |
| `rateZarPerUsdt` | Sandbox rate (production provider should supply its own quote) |
| `provider`, `providerLabel`, `providerPaymentId` | Provider metadata |
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
| `createCryptoCheckout` | Callable | Required | Validate plan, quote USDT, create payment |
| `getCryptoCheckout` | Callable | Required | Owner-only status polling |
| `confirmSandboxPayment` | Callable | Required | Local-only simulation through the same settlement path |
| `cryptoWebhook` | HTTPS | Provider signature | Verify and settle a real payment |

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
the emulator.

## Integrating a real provider

Implement `functions/src/providers/types.ts`:

```ts
export interface PaymentProvider {
  id: string;
  label: string;
  sandbox: boolean;
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
- Add App Check and per-UID rate limiting before a public launch.
- Add refunds, reconciliation, accounting, and support processes before charging.

## Compliance (not legal advice)

Accepting crypto for services in South Africa can engage FSCA crypto-asset
service-provider rules, tax/VAT reporting, and AML/KYC obligations depending on
how the service is structured. A regulated hosted provider can carry much of the
KYC/AML burden, but it does not remove your accounting and disclosure duties.
Confirm the model with a qualified adviser before going live.

## Tests

```bash
npm run functions:test    # plan maths, quote, signatures
npm run test:rules        # payment read/write rules
npm test                  # client formatting
```

The rules tests cover:

- owner can read their payment;
- another user cannot;
- no client can create, update, or delete a payment.
