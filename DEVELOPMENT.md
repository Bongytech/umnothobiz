# Developer guide

This guide covers the app in `umnotho/`. For the product overview, start with
[README.md](./README.md).

## Prerequisites

- Node.js 20.19+ and npm 10+
- Git
- A Firebase project (for real auth/Firestore) **or** the Firebase emulators
- Java 11+ if you want to run Firestore rules tests locally

## First run

```bash
git clone https://github.com/Bongytech/umnothobiz.git
cd umnothobiz/umnotho
npm install
cp .env.example .env.local
npm run dev
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

These are identifiers, not server secrets, but keep per-environment files out of
git. `.gitignore` ignores `.env` and `.env.*` except `.env.example`.

## Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Vite dev server |
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
| `npm run deploy` | Build + deploy hosting |

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
│   ├── Profile.tsx         # Public profile and received-rating average
│   ├── Pricing.tsx         # Display-only pricing (demo)
│   └── RouteGuards.tsx     # ProtectedRoute / PublicOnlyRoute
├── lib/
│   ├── firebase.ts         # Single initializeApp, auth, db, emulators
│   ├── types.ts            # Domain types
│   ├── validation.ts       # Pure listing/offer/message validation
│   ├── votes.ts            # Vote summaries and one-vote rule
│   ├── bids.ts             # Roles and status transitions
│   └── user.ts             # Rule-safe display names
└── index.css               # Tailwind theme tokens
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
- Rules tests live in `tests/rules/`.
- `npm test` does **not** start an emulator, so it is fast and works offline.
- Add a unit test for pure logic and a rules test for any new authorization path.

## CI and deployment

`.github/workflows/ci.yml` runs lint, typecheck, unit tests, build and rules
tests. `.github/workflows/deploy.yml` deploys hosting on `main` when
`FIREBASE_SERVICE_ACCOUNT` is set.

Deployment secrets:

| Secret | Used for |
| :--- | :--- |
| `FIREBASE_SERVICE_ACCOUNT` | Hosting deploy authentication |
| `VITE_FIREBASE_API_KEY` | Build-time Firebase config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Build-time Firebase config |
| `VITE_FIREBASE_PROJECT_ID` | Build-time config + hosting project |
| `VITE_FIREBASE_STORAGE_BUCKET` | Build-time config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Build-time config |
| `VITE_FIREBASE_APP_ID` | Build-time config |

## Troubleshooting

| Symptom | Likely cause |
| :--- | :--- |
| “Firebase is not configured” on load | `.env.local` missing or variable names typo’d |
| `permission-denied` when creating a listing | Not signed in, wrong `ownerId`, or a field not allowed by the rules |
| `failed-precondition` on placing an offer | Index not deployed; run `firebase deploy --only firestore:indexes` |
| Google sign-in popup closes | Domain not in Firebase Auth authorized domains, or popup blocked (the app falls back to redirect) |
| Rules tests cannot connect | Emulator not running or port 8080 is in use; `npm run test:rules` starts it for you |
| Rules tests fail to start | Java is not installed or not on `PATH` |

## Commit style

Use short, imperative commits, for example:

```text
fix(barter): send offers to activeBids and snapshot the listing
feat(auth): add protected routes and shared auth context
docs: document the rules and demo limitations
```
