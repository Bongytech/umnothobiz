# Developer guide

This guide covers the app in `umnotho/`. For the product overview, start with
[README.md](./README.md).

## Prerequisites

- Node.js 20.19+ and npm 10+
- Git
- A Firebase project (for real auth/Firestore) **or** the Firebase emulators
- Java 11+ for the Firestore emulator (rules tests and the full sandbox)

## First run

```bash
git clone https://github.com/Bongytech/umnothobiz.git
cd umnothobiz/umnotho
npm install
npm run setup:env   # or: cp .env.example .env.local, then edit it
npm run dev
```

For the crypto sandbox, also install Functions dependencies:

```bash
npm run functions:install
npm run setup:env -- --emulator --force
npm run emulators       # auth, Firestore, Functions; needs Java
npm run dev             # another terminal
```

On PowerShell, use `Copy-Item .env.example .env.local`.

`src/lib/firebase.ts` throws a readable error on startup if any required
`VITE_FIREBASE_*` value is missing. Fill `.env.local` from the Firebase console:
**Project settings → Your apps → Web app → SDK setup and configuration**.

## Environment variables

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | yes | Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | yes | Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | yes | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | yes | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | yes | Sender ID |
| `VITE_FIREBASE_APP_ID` | yes | Web app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | no | Analytics measurement ID |
| `VITE_USE_FIREBASE_EMULATORS` | no | Set to `true` to connect to local emulators |
| `VITE_RECAPTCHA_SITE_KEY` | production | App Check site key when Functions enforce App Check |

These are identifiers, not server secrets, but keep per-environment files out of
git. `.gitignore` ignores `.env` and `.env.*` except `.env.example`.

### Cloud Functions environment

Set these in `functions/.env.local` for the emulator, or as Firebase Functions
config/secrets in production. They are **never** committed.

| Variable | Purpose |
| :--- | :--- |
| `CRYPTO_PROVIDER` | Provider id (`sandbox` in emulator, `nowpayments` in production) |
| `ALLOW_SANDBOX_PAYMENTS` | Must be `true` only for local sandbox; never in production |
| `NOWPAYMENTS_API_URL` | NOWPayments API base, e.g. `https://api.nowpayments.io/v1` |
| `NOWPAYMENTS_PAY_CURRENCY` | Pay currency, default `usdttrc20` |
| `CRYPTO_WEBHOOK_URL` | Public `cryptoWebhook` URL used in the NOWPayments invoice |
| `APP_URL` | Public app URL for success/cancel redirects |
| `REQUIRE_VERIFIED_EMAIL` | Set `true` to block checkout until the email is verified |
| `ENFORCE_APP_CHECK` | Set `true` to require App Check tokens on callables |
| `USE_SECRET_MANAGER` | Set `true` to bind credentials from Secret Manager; leave false to use Functions env vars |
| `NOWPAYMENTS_API_KEY` | API key (Secret Manager or Functions env; never commit) |
| `NOWPAYMENTS_IPN_SECRET` | IPN signing secret (Secret Manager or Functions env; never commit) |
| `SANDBOX_ZAR_PER_USDT` | Sandbox quote rate, e.g. `18.50` |
| `SANDBOX_USDT_ADDRESS` | Sandbox display address |
| `SANDBOX_NETWORK` | Sandbox network label |
| `SANDBOX_WEBHOOK_SECRET` | HMAC secret for the sandbox webhook |

`NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET` must be Firebase Functions
secrets or Functions environment variables, never `.env` files or git. For
emulator-only placeholder secrets, use `functions/.secret.local` (ignored).

If `firebase deploy` reports that the Secret Manager API is disabled, either
enable it (`gcloud services enable secretmanager.googleapis.com`) or leave
`USE_SECRET_MANAGER` false and use the environment-variable fallback. The adapter
reads both paths from `process.env`.

`FUNCTIONS_EMULATOR=true` is set automatically by the emulator and enables the
sandbox provider. A deployed function with no `CRYPTO_PROVIDER` refuses checkout.

## Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Vite dev server |
| `npm run setup:env` | Write `.env.local` from the live demo’s public Firebase config |
| `npm run setup:env -- --emulator` | Write dummy `.env.local` for the emulators |
| `npm run functions:install` | Install Cloud Functions dependencies |
| `npm run functions:build` | Compile Cloud Functions |
| `npm run functions:test` | Cloud Functions unit tests |
| `npm run emulators` | Start Auth, Firestore and Functions emulators |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | ESLint (zero warnings) |
| `npm test` | Unit tests |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:rules` | Firestore rules tests (emulator) |
| `npm run security` | Lint + production audit (high) |
| `npm run security:all` | Lint + full audit including dev tooling |
| `npm run security:report` | Write a local security report |
| `npm run preview` | Preview the build |
| `npm run deploy:hosting` | Build + deploy Hosting only |
| `npm run deploy` | Build + deploy Hosting + Firestore (free/Spark compatible) |
| `npm run deploy:functions` | Deploy Functions only (requires Blaze) |
| `npm run deploy:all` | Deploy Hosting + Firestore + Functions |

## Architecture

```text
src/
├── App.tsx                 # Routes + route guards
├── main.tsx                # AuthProvider + React root
├── contexts/AuthContext.tsx
├── components/
│   ├── AppNav.tsx          # Shared signed-in navigation
│   ├── Auth.tsx            # Email/password + Google
│   ├── Barter.tsx          # Listings, questions, votes, offer modal
│   ├── MyBids.tsx          # Received/placed offers + messaging + ratings
│   ├── Profile.tsx         # Public profile, rating average, current plan
│   ├── Pricing.tsx         # Plans + crypto checkout modal
│   └── RouteGuards.tsx     # ProtectedRoute / PublicOnlyRoute
├── lib/
│   ├── firebase.ts         # Single initializeApp, auth, db, functions, emulators
│   ├── crypto.ts           # Checkout response types and formatting
│   ├── types.ts            # Domain types
│   ├── validation.ts       # Pure listing/offer/message validation
│   ├── votes.ts            # Vote summaries and one-vote rule
│   ├── bids.ts             # Roles and status transitions
│   └── user.ts             # Rule-safe display names
└── index.css               # Tailwind theme tokens

functions/
├── src/
│   ├── index.ts            # Callable functions + webhook
│   ├── payments.ts         # Checkout creation, settlement, plan activation
│   ├── plans.ts            # Server-side ZAR plan catalogue
│   ├── provider.ts         # Provider resolution and sandbox guards
│   ├── providers/          # Sandbox adapter + PaymentProvider interface
│   ├── admin.ts            # Single firebase-admin initialisation
│   └── core.ts             # Pure quote/signature/status logic
└── tsconfig.json
```

### Rules of thumb

- Keep business logic in `src/lib/` pure so it is easy to unit test.
- Keep Firestore reads/writes in components or small helpers; always handle
  `permission-denied` and `failed-precondition` with a readable message.
- Never write a field the security rules do not allow. If you add a field, update
  the rules and the rules tests in the same change.
- Use `serverTimestamp()` for top-level metadata; **do not** use it inside
  `arrayUnion` (Firestore rejects sentinels inside array elements). Use
  `Timestamp.now()` for array entries.
- Route every page that needs a user through `ProtectedRoute`; keep the auth state
  in `AuthContext`, not in per-page listeners.

## Data writes that matter

### Listing

```ts
addDoc(collection(db, 'barterItems'), {
  ownerId: user.uid,
  ownerName: displayNameFor(user),
  name, description,
  estimatedValue: parseRandValue(draft.estimatedValue),
  city, type, isBusinessBid,
  inquiries: [],
  votes: {},
  createdAt: serverTimestamp(),
});
```

### Question (append-only)

```ts
updateDoc(itemRef, {
  inquiries: arrayUnion({
    senderId: user.uid,
    senderName: displayNameFor(user),
    message,
    createdAt: Timestamp.now(),
  }),
});
```

### Vote (one per account)

```ts
updateDoc(itemRef, { [`votes.${user.uid}`]: 'up' });
```

### Offer

Create `activeBids/{id}` with a snapshot of the listing and `status: 'Pending'`.
The rules verify that `itemId` exists and that its owner matches `ownerId`. Both
participants can append messages; only the owner changes status.

## Crypto payments

Phase 1 covers Basic/Biz subscriptions. Read
[docs/crypto-payments.md](./docs/crypto-payments.md) for the full architecture,
provider adapter contract, and production checklist.

Key invariants:

- Plan prices and durations live in `functions/src/plans.ts`; the browser sends
  only a plan id.
- `createCryptoCheckout` rate-limits per account, asks the provider for a
  ZAR→USDT quote, and creates `payments/{id}`.
- NOWPayments invoices use `price_currency=zar`, `pay_currency=usdttrc20`, a
  fixed rate, and a public `CRYPTO_WEBHOOK_URL`.
- Only the signed webhook or the local sandbox confirmation can call
  `settlePayment()`; it is idempotent and activates the plan in the same
  transaction. `finished` is the only NOWPayments status treated as paid;
  `partially_paid` stays pending.
- `payments` is read-own, write-never in `firestore.rules`. Checkout creation is
  limited to five attempts per UID per 15 minutes.
- `confirmSandboxPayment` is disabled unless the Functions emulator or
  `ALLOW_SANDBOX_PAYMENTS=true` is active. Never enable it in production.
- App Check and verified-email requirements are opt-in via
  `ENFORCE_APP_CHECK=true` / `REQUIRE_VERIFIED_EMAIL=true`.
- There are no private keys in the frontend or repository. NOWPayments secrets
  live in Firebase Secret Manager and are bound to the functions.

## Firestore rules and indexes

- Rules live in `firestore.rules`; they are the authorization boundary.
- The only composite index currently needed is `activeBids(itemId, bidderId)`
  for the duplicate-offer check in `Barter.tsx`. It is declared in
  `firestore.indexes.json`.
- Deploy rules and indexes:

  ```bash
  firebase deploy --only firestore:rules,firestore:indexes
  ```

- Test rules locally:

  ```bash
  npm run test:rules
  ```

  This starts the Firestore emulator via `firebase emulators:exec` (fetched with
  `npx`), runs the Vitest suite in `tests/rules/`, and shuts the emulator down.
  Java 11+ must be installed.

## Testing

- Unit tests live next to the code as `*.test.ts` in `src/lib/`.
- Cloud Functions tests live in `functions/src/*.test.ts`.
- Rules tests live in `tests/rules/`.
- `npm test` does **not** start an emulator, so it is fast and works offline.
- Add a unit test for pure logic and a rules test for any new authorization path.
- Crypto flow end-to-end: `npm run emulators`, `npm run dev`, sign in with any
  emulator account, then Pricing → Pay with USDT → simulate payment.

## CI and deployment

`.github/workflows/ci.yml` runs lint, typecheck, unit tests, build, Functions
tests/build and rules tests. `.github/workflows/deploy.yml` deploys Hosting +
Firestore on `main` when `FIREBASE_SERVICE_ACCOUNT` is set. Cloud Functions are
deployed only when the repository variable `CRYPTO_PROVIDER=nowpayments` is set.

**Free/Spark deployment:** `firebase deploy` uses `firebase.json`, which contains
only Hosting + Firestore, so it works without a billing account. Crypto checkout
is unavailable in that mode.

**Blaze deployment:** Cloud Functions v2 need Cloud Run, Cloud Build and Artifact
Registry, which require an open billing account. Use:

```bash
npm run deploy:functions
```

This uses `firebase.functions.json`, so it does not re-deploy Hosting/Firestore.
The local full emulator stack uses `firebase.emulators.json`.

Deployment secrets:

| Secret | Used for |
| :--- | :--- |
| `FIREBASE_SERVICE_ACCOUNT` | Hosting + Functions deploy authentication |
| `VITE_FIREBASE_API_KEY` | Build-time Firebase config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Build-time Firebase config |
| `VITE_FIREBASE_PROJECT_ID` | Build-time config + deploying project |
| `VITE_FIREBASE_STORAGE_BUCKET` | Build-time config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Build-time config |
| `VITE_FIREBASE_APP_ID` | Build-time config |

Cloud Functions runtime is Node 22 (`functions/package.json`). Never commit the
service-account JSON; keep it in the GitHub secret only.

To deploy Functions automatically, set the GitHub Actions **repository variable**
`CRYPTO_PROVIDER=nowpayments` and create the Firebase secrets first:

```bash
firebase functions:secrets:set NOWPAYMENTS_API_KEY
firebase functions:secrets:set NOWPAYMENTS_IPN_SECRET
```

Without the repository variable, the workflow deploys Hosting + Firestore and
skips the Functions step. Set `APP_URL` and `CRYPTO_WEBHOOK_URL` in the Functions
environment to the real domain and deployed webhook URL.

## Troubleshooting

| Symptom | Likely cause |
| :--- | :--- |
| Blank page with no error overlay | `.env.local` missing or still contains the `.env.example` placeholders; the app should now show a “Firebase is not configured” screen listing the missing keys. Run `npm run dev` from `umnotho/` and open the Vite URL, not `index.html`. |
| “Firebase is not configured” on load | `.env.local` missing, empty, or has typo’d/placeholder variable values |
| `permission-denied` when creating a listing | Not signed in, wrong `ownerId`, or a field not allowed by the rules |
| `failed-precondition` on placing an offer | Index not deployed; run `firebase deploy --only firestore:indexes` |
| Google sign-in popup closes | Domain not in Firebase Auth authorized domains, or popup blocked (the app falls back to redirect) |
| Rules tests cannot connect | Emulator not running or port 8080 is in use; `npm run test:rules` starts it for you |
| Rules tests fail to start | Java is not installed or not on `PATH` |
| Pricing says crypto checkout is unavailable | Cloud Functions are not deployed or emulated, or `CRYPTO_PROVIDER` is unset; run `npm run emulators` or configure NOWPayments |
| Functions emulator fails to load | Run `npm run functions:build`; check `firebase-debug.log` and that `functions/package.json` main points at `lib/index.js` |
| `permission-denied` confirming sandbox payment | `ALLOW_SANDBOX_PAYMENTS`/emulator guard is off, or the payment is expired |
| `failed-precondition` starting checkout | Email verification is required (`REQUIRE_VERIFIED_EMAIL=true`), or NOWPayments is not configured |
| NOWPayments webhook 400 | Wrong `x-nowpayments-sig`, missing `order_id`, or `CRYPTO_WEBHOOK_URL` mismatch |

### Windows: esbuild “Access is denied” during build

If `npm run build` fails with `[vite:esbuild-transpile] remove ...esbuild-...: Access is denied`, the
workspace was marked with the Windows **Low** integrity label (often after a sandboxed run).
The esbuild executable cannot then delete its temp files. Raise the executable and its parent
directories to Medium, then rebuild:

```powershell
icacls "node_modules\@esbuild" /setintegritylevel "(OI)(CI)Medium"
icacls "node_modules\@esbuild\win32-x64" /setintegritylevel "(OI)(CI)Medium"
icacls "node_modules\@esbuild\win32-x64\esbuild.exe" /setintegritylevel Medium
npm run build
```

Run this again after a fresh `npm ci` if the workspace itself still has the Low label.

## Commit style

Use short, imperative commits, for example:

```text
fix(barter): send offers to activeBids and snapshot the listing
feat(auth): add protected routes and shared auth context
docs: document the rules and demo limitations
```
