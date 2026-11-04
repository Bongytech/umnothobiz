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
- **Security rules** — Firestore rules enforce ownership, participation and
  append-only writes; see [firestore.rules](./umnotho/firestore.rules).

### Deliberate demo limitations

This is not a production marketplace. In particular:

- **Payments are not connected.** The pricing page documents the intended plans
  but does not collect card details or change a user's plan.
- There is no image upload, notification, search index, admin/moderation console,
  or email-verification gate.
- Ratings are not tied to a verified completed transaction server-side; that
  would require a Cloud Function or trusted backend.
- There is no SLA, backup policy, or compliance certification.

---

## Tech stack

| Layer | Choice |
| :--- | :--- |
| UI | React 18, TypeScript, Tailwind CSS 4, Motion, Lucide icons |
| Build | Vite 6, TypeScript project references |
| Routing | React Router 7 |
| Backend | Firebase Authentication + Cloud Firestore |
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

### Optional: run against the emulators

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
| `npm run build` | Typecheck and build the production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc -b` without emitting |
| `npm run lint` | ESLint with zero warnings allowed |
| `npm test` | Vitest unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:rules` | Firestore rules tests against the emulator |
| `npm run security` | Lint plus a production-dependency audit (`npm audit --omit=dev`) |
| `npm run security:all` | Same, including dev-tool advisories |
| `npm run deploy` | Build and deploy Firebase Hosting |

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
│   ├── lib/              # Firebase setup, types, validation, bid/vote logic
│   └── main.tsx
├── tests/rules/          # Firestore security-rules tests
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
  fields. A future backend should derive those values from verified events.
- No secrets are committed; `.env*` files are ignored except `.env.example`.

See [SECURITY.md](./SECURITY.md) for the threat model and reporting process.

---

## Testing and CI

- **Unit tests** cover validation, vote summaries, bid roles/transitions, and
  display-name handling (`src/lib/*.test.ts`).
- **Rules tests** start the Firestore emulator and exercise owner, participant and
  outsider access (`tests/rules/`).
- **CI** runs lint, typecheck, unit tests, the production build, and rules tests on
  every push and pull request.
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
