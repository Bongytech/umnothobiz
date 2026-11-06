# Security policy

Umnotho is an agent-maintained public project, not a fully audited production
marketplace. This document describes what the code actually enforces so
contributors and users can reason about risk honestly.

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
  - only the owner can read a profile document (private contact data); public
    display names are denormalised onto listings and bids;
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
  secrets (when `USE_SECRET_MANAGER=true`) or Functions environment variables.
  Both live server-side; never `VITE_*` and never committed. The environment
  fallback is less isolated; prefer Secret Manager once the API is enabled.
- A deployed function with no `CRYPTO_PROVIDER` refuses to create a checkout.
  The sandbox adapter only works when the Functions emulator is running.
- `confirmSandboxPayment` is disabled unless `FUNCTIONS_EMULATOR=true`, or
  `ALLOW_SANDBOX_PAYMENTS=true` **and** the project is in
  `SANDBOX_PROJECT_ALLOWLIST` (demo projects are allowed). A production project
  cannot enable the sandbox with one environment variable.
- NOWPayments in a deployed environment requires `USE_SECRET_MANAGER=true`; the
  API key and IPN secret are bound from Secret Manager.
- NOWPayments webhooks are verified with HMAC-SHA512 over the sorted raw JSON
  body (`x-nowpayments-sig`). The settlement transaction is idempotent, rejects
  missing/underpaid amounts, accepts overpayments for follow-up, and only
  `finished` counts as paid. Late paid events still activate the plan.
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
  (`npm audit --omit=dev --audit-level=high`); CI fails on **high** or **critical**
  runtime advisories in both the app and the Functions tree. `npm run security:all`
  also includes dev-tool advisories, which are reported but do not block because
  they never ship.
- `.env*` files are ignored except `.env.example`; service-account JSON,
  `functions/.env*`, and `functions/lib` are ignored.
- `.env` and credential files are blocked twice: a gitleaks pre-commit hook and
  the repository's push protection.
- CI scans for secrets with gitleaks on every pull request (only the commits that
  PR adds, so legacy history cannot red-build an unrelated change) and over the
  full history every week. False positives are allowlisted narrowly in
  `.gitleaks.toml` with a comment; the job is never disabled.
- CodeQL runs `security-extended` queries on pull requests, `main` and weekly.
- Dependency review blocks pull requests that introduce a high-severity advisory,
  and Dependabot keeps npm and GitHub Actions dependencies current weekly.
- GitHub Actions workflows use a committed lockfile (`npm ci`), least-privilege
  `permissions`, and every action pinned to a full commit SHA. No workflow uses
  `pull_request_target` or checks out and executes untrusted fork code.
- Deployment is gated on a green CI run for the same commit, deploys
  `firestore.rules` together with the app so rules cannot drift, and smoke tests
  the live site and its security headers after upload.
- Pull requests get an isolated Firebase Hosting preview channel, so review
  happens against a real build without touching production.
- A weekly job produces CycloneDX SBOMs for the app and Functions dependency
  trees (90-day retention), so an advisory can be matched against what actually
  shipped.
- Branch protection (required checks, linear history, no force pushes, no
  deletions) is applied from
  [`scripts/ops/apply-branch-protection.mjs`](./scripts/ops/apply-branch-protection.mjs)
  so the settings are reviewable; `CODEOWNERS` marks the rules, payment code and
  pipelines for review.
- `firestore.rules` uses deny-by-default and is covered by emulator tests,
  including payment access.
- Pipeline details are in [docs/devops.md](./docs/devops.md); incident, rollback
  and credential-rotation procedures are in [docs/runbook.md](./docs/runbook.md).

## Hardening ideas for a real deployment

1. Add server-enforced quotas for listings, questions, bids, and messages.
2. Validate ratings in a trusted backend instead of a client-written map.
3. Add moderation/admin tooling and an abuse report queue.
4. Add KYB checks for business accounts, refunds, receipts, and tax/VAT reporting.
5. Add automated backup/export and an incident-response runbook.

Last reviewed: 2026-11-06.
