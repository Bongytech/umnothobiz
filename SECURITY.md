# Security policy

Umnotho is a portfolio project, not a hardened production marketplace. This
document describes what the code actually enforces so contributors and users can
reason about risk honestly.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Email
[bongytech@gmail.com](mailto:bongytech@gmail.com) with:

- what you found and where,
- steps to reproduce,
- the impact you believe it has,
- any suggested fix.

You can expect an acknowledgement within a few days. This is a volunteer
project, so there is no formal SLA or bug bounty.

## Trust boundaries

| Boundary | What protects it |
| :--- | :--- |
| Browser → Firebase Auth | Firebase Authentication issues ID tokens |
| Browser → Firestore | `firestore.rules` on the server; client checks are UX only |
| Repository → deployment | GitHub Actions secrets; no service account is committed |
| Firebase project | Google-managed TLS and encryption at rest (Firebase platform), plus project IAM |

Firebase web configuration values (`apiKey`, `projectId`, …) are not server
secrets. They identify the project and are safe to ship in the browser. Access
control must come from Authentication and Firestore rules.

## What the rules enforce

The full source is [umnotho/firestore.rules](./umnotho/firestore.rules).

- **Deny by default.** Only `users`, `barterItems` and `activeBids` are matched.
- **Users**
  - signed-in users may read profiles;
  - a user may edit only their own `displayName`, `photoURL` and `updatedAt`;
  - another signed-in user may add **one** rating under their own UID, with a
    value from 1 to 5, and cannot overwrite it;
  - `reputation`, `subscriptionTier` and similar fields cannot be written by a
    client.
- **Listings**
  - public read;
  - create only with `ownerId == auth.uid` and a constrained schema
    (name, description, value, city, type, business flag);
  - edit/delete only by the owner;
  - questions are append-only: the signed-in author's UID must match the new
    entry, the array may only grow by one, and the message is length-limited;
  - votes are one immutable map entry per UID, and the owner cannot vote on their
    own listing.
- **Bids**
  - readable only by `ownerId` and `bidderId`;
  - create only by the bidder, for an existing listing whose owner matches, with
    status `Pending` and no messages;
  - only the owner may move the status to `In Negotiation`, `Completed` or
    `Declined`; closed bids cannot be reopened;
  - either participant may append a message with their own UID and a bounded
    length;
  - either participant may delete the bid (withdraw/decline).
- **Payments**
  - `payments/{id}` is readable only by its owner;
  - clients cannot create, update, or delete payment documents — only the Admin
    SDK inside Cloud Functions can;
  - plan prices, durations, and the ZAR→USDT quote are chosen server-side;
  - a plan is activated only by the settlement transaction after a verified
    webhook (or the explicitly local sandbox confirmation);
  - `subscriptionTier` and related fields remain server-written only.

## Crypto payments

Phase 1 includes a **NOWPayments** live adapter and a local sandbox. Full details
are in [docs/crypto-payments.md](./docs/crypto-payments.md).

- There are no private keys, seed phrases, provider API keys, or service-account
  credentials in the app, the functions source, or this repository.
- `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET` are Firebase Functions
  secrets, bound to the checkout/webhook functions. They are never `VITE_*`.
- A deployed function with no `CRYPTO_PROVIDER` refuses to create a checkout.
  The sandbox adapter only works when the Functions emulator is running.
- `confirmSandboxPayment` is disabled unless `FUNCTIONS_EMULATOR=true` or
  `ALLOW_SANDBOX_PAYMENTS=true`. The latter must never be set in production.
- NOWPayments webhooks are verified with HMAC-SHA512 over the sorted raw JSON
  body (`x-nowpayments-sig`). The settlement transaction is idempotent, rejects
  an amount more than 2% below the quote, and only `finished` counts as paid.
- Checkout creation is rate-limited to five attempts per UID per 15 minutes.
- App Check enforcement and verified-email requirements are opt-in
  (`ENFORCE_APP_CHECK=true`, `REQUIRE_VERIFIED_EMAIL=true`) and should be enabled
  for production.
- A real launch still requires a provider business account, compliance review,
  refunds/reconciliation, and monitoring. Do not put provider API secrets in Vite
  variables — anything prefixed `VITE_` ships to the browser.

## Public repository rules

This repository is public. Therefore:

- Never commit `.env`, `.env.local`, `functions/.env*`, `functions/.secret.local`,
  service-account JSON, provider API keys, wallet private keys, seed phrases, or
  webhook secrets.
- Firebase **web** config values (`VITE_FIREBASE_*`) are public identifiers that
  ship in the browser bundle; they are not authorization. Do not treat them as
  secrets, but still keep per-environment files out of git.
- Deployment credentials belong in GitHub Actions secrets
  (`FIREBASE_SERVICE_ACCOUNT`) or Firebase Functions secrets, never in code.
- If a secret is ever committed, rotate it immediately and purge it from git
  history; deleting the file in a new commit is not enough.
- Restrict the Firebase web API key by HTTP referrer/API in Google Cloud, enable
  App Check, and use least-privilege IAM for the deploy service account.

## Known limitations

These are deliberate gaps in a demo, not unnoticed bugs:

- **No rate limiting for listings, questions, bids, or messages.** Checkout
  creation is limited, but social/content endpoints still rely on the schema.
- **Ratings are not tied to a verified completed transaction** in rules. The UI
  only offers rating after a completed bid, but a determined client could write a
  rating for any other user once. A production system needs a trusted backend or
  Cloud Function to validate the trade.
- **Email verification is opt-in.** It is sent at signup and enforced for
  checkout only when `REQUIRE_VERIFIED_EMAIL=true`.
- **Live crypto is configured, not enabled by default.** The NOWPayments adapter
  is present, but no provider keys are committed and the live path stays off until
  Firebase secrets and the webhook URL are configured.
- **No moderation or admin tooling.** Abusive content must be handled manually in
  the Firebase console.
- **No image/file storage.** The Storage integration is not enabled.
- **Rules tests require the emulator.** They run in CI with Java and confirm the
  access rules, but they do not test Firebase project IAM or billing controls.

## Secure development practices in this repo

- ESLint runs with TypeScript, React Hooks and security plugins; CI allows zero
  warnings.
- `npm run security` runs the linter and a production-dependency audit
  (`npm audit --omit=dev --audit-level=high`); `npm run security:all` also
  includes dev-tool advisories. The application's production dependency tree
  currently audits clean; the remaining advisories are in development tooling.
- `.env*` files are ignored except `.env.example`; service-account JSON,
  `functions/.env*`, and `functions/lib` are ignored.
- GitHub Actions uses npm with a committed lockfile and least-privilege
  permissions; deployment secrets are referenced only through `secrets.*`.
- `firestore.rules` uses deny-by-default and is covered by emulator tests,
  including payment access.
- Secret scanning can be enabled with GitHub's own secret scanning or a gitleaks
  pre-commit hook; the old ad-hoc workflow files were removed because they
  referenced a non-existent `functions/` directory.

## Hardening ideas for a real deployment

1. Add a real provider adapter with signed webhooks, amount/asset/network
   validation, and reconciliation.
2. Add App Check to reduce scripted abuse.
3. Add per-UID rate limiting on checkout creation and webhook processing.
4. Add email verification and, for business accounts, KYB checks.
5. Add refunds, receipts, tax/VAT reporting, and a payment support process.
6. Add automated backup/export and an incident-response runbook.
7. Add dependency and container scanning (Dependabot is already configured).

Last reviewed: 2026-11-04.
