# Umnotho — trade without money

<p align="center">
  <img src="./umnotho/src/assets/Umnotho2.png" alt="Umnotho logo" width="167" height="116" />
</p>

[![CI](https://github.com/Bongytech/umnothobiz/actions/workflows/ci.yml/badge.svg)](https://github.com/Bongytech/umnothobiz/actions/workflows/ci.yml)

Umnotho is a peer-to-peer barter marketplace. People list goods or services, make
trade offers, negotiate in a private thread, and rate each other after a trade.
It is a portfolio project built with React, TypeScript, Vite, Tailwind CSS and
Firebase.

**Live demo:** [umnothobiz.web.app](https://umnothobiz.web.app/)

> The live site may lag behind `main` until the deployment workflow runs.

---

## What works

- **Accounts** — email/password and Google sign-in, with protected routes and a
  single shared auth context.
- **Listings** — create, browse, filter by city/type/maximum value, and view your
  own listings.
- **Questions** — append-only public questions on each listing.
- **Offers** — send an offer with a written trade proposal; see offers received
  and offers placed under **My Bids**.
- **Negotiation** — private message threads, status changes (pending, in
  negotiation, completed, declined), and withdrawal of an offer.
- **Ratings** — one 1–5 star rating per trader per completed trade, shown as an
  average on the profile.
- **Crypto subscription checkout** — ZAR-priced Basic/Biz plans paid in USDT via
  a provider-agnostic hosted checkout. A Cloud Function verifies the payment and
  activates the plan; the browser can never grant a plan.
- **Security rules** — Firestore rules enforce ownership, participation and
  append-only writes; see [firestore.rules](./umnotho/firestore.rules).

### Deliberate demo limitations

This is not a production marketplace. In particular:

- **Crypto checkout currently runs in sandbox mode.** It shows a test address and
  can only be confirmed by the local Functions emulator. No real funds are
  collected and no live provider is configured yet. See
  [docs/crypto-payments.md](./docs/crypto-payments.md) for the provider
  integration points.
- Barter top-ups and on-chain escrow are planned phases, not implemented.
- There is no image upload, notification, search index, admin/moderation console,
  or email-verification gate.
- Ratings are not tied to a verified completed transaction server-side; the UI
  only offers rating after a completed bid, but a custom client could still rate
  another user once.
- There is no SLA, backup policy, refund flow, or compliance certification.

---

## Tech stack

| Layer | Choice |
| :--- | :--- |
| UI | React 18, TypeScript, Tailwind CSS 4, Motion, Lucide icons |
| Build | Vite 6, TypeScript project references |
| Routing | React Router 7 |
| Backend | Firebase Authentication + Cloud Firestore + Cloud Functions |
| Crypto | Provider-agnostic hosted checkout; USDT settlement; sandbox first |
| Tests | Vitest, Firebase Rules Unit Testing |
| CI | GitHub Actions (lint, typecheck, unit tests, build, rules tests) |

---

## Getting started

### Prerequisites

- Node.js **20.19+** (see `engines` in [package.json](./umnotho/package.json))
- npm 10+
- A Firebase project

### Run locally

```bash
git clone https://github.com/Bongytech/umnothobiz.git
cd umnothobiz/umnotho

npm install

# Option A (fastest): pull the public web config from the live demo
npm run setup:env

# Option B: start from the template and paste your own project's values
cp .env.example .env.local   # Windows: copy .env.example .env.local
```

Fill in `.env.local` from **Firebase console → Project settings → Your apps → Web
app → SDK setup**. Then:

```bash
npm run dev
```

The app is served at the URL Vite prints (usually `http://localhost:5173`).

### If the page is blank

The most common cause is a missing or unedited `.env.local`. Umnotho now renders
a **“Firebase is not configured”** screen that lists the exact variables that
are missing, instead of showing a blank page. Also make sure you run `npm run dev`
from the `umnotho/` folder (not the repository root) and open the URL Vite prints,
not the `index.html` file directly.

If you copied `.env.example` without replacing the placeholders, the same screen
will appear. Paste the real values from Firebase console → Project settings →
Your apps → Web app, then restart the dev server.

### Firebase setup

1. Create a Firebase project and a **Web app**.
2. Enable **Email/Password** and **Google** under Authentication → Sign-in method.
3. Create a **Firestore** database.
4. Deploy the rules and indexes:

   ```bash
   firebase login
   firebase use --add            # select your project
   firebase deploy --only firestore:rules,firestore:indexes
   ```

5. Add `localhost` and your production domain under Authentication → Settings →
   Authorized domains.

The Firebase web config values are identifiers, not server secrets. Data access
is controlled by `firestore.rules`, not by hiding the config.

### Optional: run the crypto sandbox end-to-end

The crypto checkout needs Cloud Functions. For a completely local, no-real-money
run:

```bash
npm run functions:install
npm run setup:env -- --emulator --force
npm run emulators        # auth, Firestore and Functions; needs Java
# in another terminal
npm run dev
```

Use any email/password on the Auth emulator screen, then open **Pricing** and pay
with the sandbox button. No real funds move.

### Optional: run against the emulators without crypto

```bash
firebase emulators:start --only auth,firestore
# in another terminal
VITE_USE_FIREBASE_EMULATORS=true npm run dev
```

The emulator UI is available at `http://localhost:4000` by default.

---

## Commands

Run these from the `umnotho/` directory.

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Vite dev server with HMR |
| `npm run setup:env` | Write `.env.local` from the public config of the live demo |
| `npm run setup:env -- --emulator` | Write a dummy `.env.local` for the Firebase emulators |
| `npm run functions:install` | Install Cloud Functions dependencies |
| `npm run functions:build` | Compile Cloud Functions |
| `npm run functions:test` | Run Cloud Functions unit tests |
| `npm run emulators` | Start Auth, Firestore and Functions emulators |
| `npm run build` | Typecheck and build the production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc -b` without emitting |
| `npm run lint` | ESLint with zero warnings allowed |
| `npm test` | Vitest unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:rules` | Firestore rules tests against the emulator |
| `npm run security` | Lint plus a production-dependency audit (`npm audit --omit=dev`) |
| `npm run security:all` | Same, including dev-tool advisories |
| `npm run deploy:hosting` | Build and deploy Firebase Hosting only |
| `npm run deploy` | Build and deploy Hosting + Cloud Functions |

`test:rules` needs a Java runtime for the Firestore emulator (the Firebase CLI is
fetched through `npx`):

```bash
npm run test:rules
```

---

## Project structure

```text
umnotho/
├── src/
│   ├── components/       # Pages and shared UI (Barter, MyBids, Auth, …)
│   ├── contexts/         # AuthProvider / useAuth
│   ├── lib/              # Firebase setup, types, validation, bid/vote/crypto logic
│   └── main.tsx
├── functions/            # Cloud Functions: checkout, webhook, plan activation
│   └── src/
├── tests/rules/          # Firestore security-rules tests
├── docs/                 # Crypto-payment architecture and provider guide
├── firestore.rules       # Server-side authorization
├── firestore.indexes.json
├── firebase.json
└── vite.config.ts
```

---

## Data model

| Collection | Purpose | Access |
| :--- | :--- | :--- |
| `users/{uid}` | Display name, email, one-time ratings map | Signed-in users can read; owners edit public fields; others may add only their own rating |
| `barterItems/{id}` | Listing, questions, votes | Public read; owner-only create/edit/delete; anyone signed in may append a question or one vote |
| `activeBids/{id}` | Offer snapshot, status, private messages | Only the owner and bidder can read/write; owner controls status; both can message |
| `payments/{id}` | Crypto checkout: plan, ZAR/USDT amount, provider reference, status | Owner can read; only Cloud Functions can create/update/delete |

`users/{uid}` also gains server-written `subscriptionTier`, `subscriptionStatus`,
`subscriptionExpiresAt`, `subscriptionStartedAt` and `lastPaymentId` after a
verified payment. Clients cannot write those fields.

New listings use `ownerId`; the client also understands the legacy `owner` field
so older documents continue to work.

---

## Security model

- **Deny by default.** Only the paths above are matched.
- Listings are created with the signed-in user's `ownerId`; edits and deletes are
  owner-only.
- Questions and votes are **append-only**. Votes and ratings are keyed by the
  author's UID, so one account cannot overwrite another person's data.
- Bid documents are readable only by the two participants. The owner is the only
  person who can change the offer status.
- Clients cannot write `reputation`, `subscriptionTier`, or other privileged
  fields. Plan activation happens only in a Cloud Function transaction after a
  verified payment.
- Payment documents are write-only through the Admin SDK; clients may read their
  own payment but cannot create one or mark it paid.
- No secrets are committed; `.env*` files are ignored except `.env.example`.
  Service-account JSON and webhook secrets stay in GitHub/Firebase secrets. This
  repository is public — see [SECURITY.md](./SECURITY.md) before adding config.

See [SECURITY.md](./SECURITY.md) for the threat model and reporting process.

---

## Testing and CI

- **Unit tests** cover validation, vote summaries, bid roles/transitions,
  display-name handling, and crypto formatting (`src/lib/*.test.ts`).
- **Cloud Functions tests** cover plan maths, ZAR→USDT quoting, payment statuses,
  and sandbox webhook signatures (`functions/src/*.test.ts`).
- **Rules tests** start the Firestore emulator and exercise owner, participant,
  outsider, and payment access (`tests/rules/`).
- **CI** runs lint, typecheck, unit tests, the production build, Cloud Functions
  tests/build, and rules tests on every push and pull request.
- **Deployment** runs on `main` when `FIREBASE_SERVICE_ACCOUNT` is configured;
  otherwise the deploy step is skipped instead of failing the build.

---

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). Bug reports and focused pull
requests are welcome.

## License

Umnotho is source-available for learning and non-commercial use. Commercial use
requires written permission. See [LICENSE.md](./LICENSE.md) for the full terms.

---

Built by [Bongytech](https://github.com/Bongytech). Questions:
[bongytech@gmail.com](mailto:bongytech@gmail.com).
