# Code review — `Bongytech/umnothobiz`

**Reviewed commit:** `31e1f2d` (Merge PR #18, `main`) · **Date:** 6 November 2026
**Reviewer:** Individual-person · **Scope:** whole repository (React/TS client, Firestore rules, Cloud Functions, CI/CD, docs, scripts)

---

## Summary

This is an unusually well-documented and deliberately scoped portfolio project. The security
model is real rather than decorative: rules are deny-by-default, payment documents are
Admin-SDK-only, the plan catalogue and ZAR→USDT quote live server-side, and the README/
SECURITY docs are honest about what is *not* built. Lint, typecheck and the production
dependency audit are clean.

The two things that most need attention are **operational, not stylistic**:

1. **CI/CD has never run.** Every workflow lives in `umnotho/.github/workflows/` instead of
   the repository-root `.github/workflows/`, so GitHub does not see them at all
   (`GET /repos/Bongytech/umnothobiz/actions/workflows` → `total_count: 0`). The README badge
   is dead and several docs claim checks that never execute.
2. **The payment settlement path can take money and grant nothing.** A provider confirmation
   that arrives after the checkout TTL is converted to `expired` instead of `paid`, and the
   payment document is written *after* the provider invoice is created, so a webhook can
   arrive for a document that does not exist yet.

Everything else is in the normal "good demo, not yet production" range: unbounded Firestore
listeners, no rate limiting on social writes, a rating model that trusts the client, and a few
UI/a11y/encoding defects.

### Verification performed

| Check | Result |
| :--- | :--- |
| `tsc -b` (project references) | ✅ clean |
| `eslint . --max-warnings 0` | ✅ clean |
| `npm audit --omit=dev` (103 prod deps) | ✅ 0 vulnerabilities |
| `npm test` (vitest) | ⚠️ could not run in this environment (esbuild `spawn EPERM` in the review sandbox) — not a repo defect |
| GitHub Actions workflows registered | ❌ `total_count: 0` |

---

## Findings

| # | Severity | Area | Finding |
| :- | :--- | :--- | :--- |
| 1 | **Blocker** | CI/CD | Workflows are in the wrong directory — nothing runs, badge is dead |
| 2 | **High** | Payments | Paid webhook arriving after `expiresAt` is discarded → customer pays, gets no plan |
| 3 | **High** | Payments | Payment doc written after provider invoice → orphan invoices, webhook race |
| 4 | **High** | Payments | Webhook returns HTTP 400 for internal errors → provider retries are suppressed |
| 5 | **High** | Payments | `ALLOW_SANDBOX_PAYMENTS=true` in prod = free subscriptions |
| 6 | **High** | Privacy | Any signed-in user can read every user's document, including `email` |
| 7 | **High** | Compliance | No account-deletion path, despite the privacy policy promising deletion |
| 8 | Medium | Perf/cost | Unbounded `onSnapshot` over the entire `barterItems` collection |
| 9 | Medium | Abuse | No limits on bids/questions/messages; duplicate-bid check is client-side and racy |
| 10 | Medium | Integrity | Bids can be deleted after `Completed`/`Declined`, erasing trade history |
| 11 | Medium | Integrity | Ratings are not tied to a completed trade in rules |
| 12 | Medium | Payments | Overpayments are marked `failed`; a missing amount skips verification entirely |
| 13 | Medium | Payments | No reconciliation/expiry sweeper; `pending` payments live forever |
| 14 | Medium | Billing | Plan change/downgrade prorating is undefined; `subscriptionStartedAt` is overwritten |
| 15 | Medium | Consistency | Plan prices duplicated in `Pricing.tsx` and `plans.ts` |
| 16 | Medium | UX | Checkout polling never stops after expiry, no backoff, no tab-visibility guard |
| 17 | Medium | Quality | Mojibake in user-visible strings (`â€¦`, `Â·`) in two components |
| 18 | Medium | A11y | Modals have no focus trap / Escape handling; clickable `div` in the landing page |
| 19 | Medium | Security | No `Content-Security-Policy` response header |
| 20 | Medium | Testing | No component tests and no tests for the settlement/webhook/rate-limit paths |
| 21 | Medium | Tooling | `rotate-secrets.sh` is broken *and* destructive (BFG would purge all JSON history) |
| 22 | Low | Tooling | `security-monitor.js` calls a script that does not exist |
| 23 | Low | Security | gitleaks/pre-commit never runs (same root-path problem); allowlist paths are stale |
| 24 | Low | Docs | Docs disagree with reality and with each other (CI, paths, contact email) |
| 25 | Low | Correctness | Fragile string-based rate-limit signalling; blind casts in the payment API layer |
| 26 | Low | UX | Signup success notice is thrown away by an immediate `navigate` |

---

## Blocker

### 1. CI and deployment never run — `.github` is one directory too deep

`umnotho/.github/workflows/ci.yml`, `umnotho/.github/workflows/deploy.yml` and
`umnotho/.github/dependabot.yml` are not in the location GitHub reads. Only
`/.github/workflows` at the **repository root** is evaluated, so:

- no push or PR ever triggers a check (`actions/workflows` returns zero workflows);
- the README badge (`README.md:7`) has nothing to report;
- Dependabot never opens PRs;
- `SECURITY.md:138` ("CI allows zero warnings") and
  `DEVELOPMENT.md:269` ("`.github/workflows/ci.yml` runs lint, typecheck…")
  describe a pipeline that does not exist.

This is also why a broken build would not be caught: `ci.yml` assumes the app is the repository
root (`npm ci`), which it is not.

**Fix** — move the whole `.github` directory to the root and add `working-directory`:

```yaml
# .github/workflows/ci.yml
defaults:
  run:
    working-directory: umnotho
```

and for the two `npm --prefix functions` steps keep them relative to that directory. For
Dependabot, declare both manifests:

```yaml
# .github/dependabot.yml
updates:
  - package-ecosystem: npm
    directory: /umnotho
    ...
  - package-ecosystem: npm
    directory: /umnotho/functions
    ...
```

For `deploy.yml` also set `entryPoint: umnotho` (or `workingDirectory`) on
`FirebaseExtended/action-hosting-deploy`, otherwise it looks for `firebase.json` at the root.

---

## High

### 2. A late provider confirmation is turned into `expired` — the customer pays and gets nothing

`umnotho/functions/src/payments.ts:227-232` handles expiry **before** it handles `paid`:

```ts
const now = Timestamp.now();
const expiresAt = data.expiresAt;
if (expiresAt instanceof Timestamp && expiresAt.toMillis() <= now.toMillis()) {
  transaction.update(paymentRef, { status: 'expired', updatedAt: now });
  return;                       // ← even when event.status === 'paid'
}
```

NOWPayments invoices are confirmed on-chain, so a `finished` IPN routinely arrives later than
the last `confirming` one. With `ttlMinutes = 10` (`providers/nowpayments.ts:97`) a payment made
at minute 9 that confirms at minute 12 is recorded as `expired`. The user's USDT is gone and the
subscription is never activated. The refund policy in `LegalPage.tsx:139` already anticipates
this manual case ("If a payment failed but your wallet shows a confirmed transfer…") — it should
not be a support ticket.

**Fix:** never let expiry override a positive provider verdict. Check `paid` first, and only
expire when the event is *not* paid (or when the provider itself says the invoice expired):

```ts
if (event.status === 'paid') { /* … settle, ignore local TTL … */ }
if (data.status !== 'pending') return;
if (expiresAt instanceof Timestamp && expiresAt.toMillis() <= now.toMillis()) {
  transaction.update(paymentRef, { status: 'expired', updatedAt: now });
  return;
}
```

Consider also recording `latePayment: true` so it is queryable for reconciliation.

### 3. The payment document is written *after* the provider invoice is created

`umnotho/functions/src/payments.ts:116-147`: `provider.createCheckout()` runs first, then
`paymentRef.set(payment)`. Two failure modes:

- If the Firestore write fails (quota, transient), an invoice exists at the provider that no
  document references. The user may still pay it; retries create a second invoice.
- A fast IPN arriving in that window hits `settlePayment` → `Payment not found` → the webhook
  answers 400 and the provider may stop retrying.

**Fix:** write the `pending` document first (with `provider: null`, `checkoutUrl: null`), then
create the provider session, then patch the document. Alternatively use the provider's invoice
id as the document id and create the doc in the webhook if missing. Add an idempotency key to
the provider request as well (`order_id` already exists — reuse it on retries instead of calling
`/invoice` again when a `pending` doc already has a `providerPaymentId`).

### 4. Every webhook failure is reported as `400 Invalid webhook`

`umnotho/functions/src/index.ts:103-117` wraps parsing, settlement, Firestore and
provider construction in a single `try/catch` that always responds `400`. A transient Firestore
error or a cold-start secret failure is indistinguishable from a forged signature, and most
providers treat 4xx as "do not retry".

**Fix:** return `400` only for signature/parse failures, `5xx` for anything else so the provider
retries:

```ts
let event: WebhookEvent;
try { event = provider.parseWebhook(rawBody, signature); }
catch { response.status(400).json({ ok: false, error: 'Invalid signature' }); return; }

try { await handleWebhook(event); }
catch (error) { console.error('Settlement failed', error); response.status(500).json({ ok: false }); return; }
response.status(200).json({ ok: true });
```

### 5. `ALLOW_SANDBOX_PAYMENTS=true` is a one-variable path to free subscriptions

`umnotho/functions/src/provider.ts:17-19` treats the env var as sufficient authorisation, and
`confirmSandbox` (`payments.ts:173-179`) then settles any pending payment as paid. Nothing checks
that the function is running in the emulator or that the project is a non-production one. A
copy-paste of `functions/.env.<project>` from local dev into production (the docs literally list
this block at `docs/crypto-payments.md:108-115`) hands every signed-in user the Biz plan.

**Fix:** make it impossible rather than documented. E.g. require both
`process.env.ALLOW_SANDBOX_PAYMENTS === 'true'` **and** `process.env.GCLOUD_PROJECT` starting
with `demo-`, or refuse whenever `process.env.K_SERVICE` is set without an explicit
`SANDBOX_PROJECT_ALLOWLIST`. At minimum, log a loud error at cold start when
`ALLOW_SANDBOX_PAYMENTS` is set on a deployed function.

### 6. Any signed-in user can read every other user's `email`

`umnotho/firestore.rules:46` — `allow read: if signedIn();` — combined with
`email` being stored on the profile document (`AuthContext.tsx:44`) and list queries being
allowed, means any account can enumerate `users/*` and harvest every email address. The client
never needs this: `Profile.tsx` reads only `users/{uid}`, and listings carry a denormalised
`ownerName`.

**Fix (pick one):**

- split the document: public `profiles/{uid}` (`displayName`, `photoURL`, `ratings`) readable by
  anyone, private `users/{uid}` readable only by the owner; or
- keep one document but only ever write `email` server-side into a subcollection
  (`users/{uid}/private/contact`) and drop it from the public rule surface.

Also restrict `allow read` to `get` where possible and add `allow list: if false` unless the UI
genuinely queries the collection.

### 7. No account-deletion path, while the privacy notice promises one

`firestore.rules:65` — `allow delete: if false;` — and there is no callable or scheduled
function that deletes a user's Auth record, profile, listings, bids and payments.
`LegalPage.tsx:106` tells users they can "ask for access, correction, or deletion of your
personal information by emailing…". POPIA (and GDPR, if you accept EU users) treat erasure as a
right; a manual console process that is not written down is a compliance gap and a support
burden.

**Fix:** add a `deleteMyAccount` callable that (a) requires recent re-authentication,
(b) anonymises `barterItems`/`activeBids` instead of hard-deleting where other users' messages
reference them, (c) deletes payments after the statutory retention window or keeps a
pseudonymised record, and (d) deletes the Auth user last. Document the retention carve-out in
the privacy page.

---

## Medium

### 8. Unbounded real-time listeners

`src/components/Barter.tsx:131-133` subscribes to the **entire** `barterItems` collection with
no `limit` and no pagination; `MyBids.tsx:104-105` and `Profile.tsx:67-68` are unbounded per-user
queries. Because rules allow public read, a script can also page the whole collection at your
expense. Every vote or question rewrites the parent document, so a single popular listing
re-broadcasts the whole collection to every open tab.

**Fix:** `query(collection(db, 'barterItems'), orderBy('createdAt', 'desc'), limit(50))` plus
`startAfter` pagination, and drive city/type/value filters server-side (they need composite
indexes in `firestore.indexes.json`). Consider splitting `inquiries` into a subcollection so a
question does not invalidate the listing document and re-render every card.

### 9. No quota on bids, questions or messages; duplicate-bid guard is client-side

`Barter.tsx:286-303` checks for an existing open offer with `getDocs(...)` before `addDoc`. That
is racy (two tabs, two devices) and costs a read; the rules impose no limit, so a determined
client can create thousands of bids per listing (`activeBids` create rule, `firestore.rules:153-179`)
and flood the owner's "Offers received" dashboard. SECURITY.md acknowledges the missing rate
limits, but the duplicate-bid case is cheap to make structural.

**Fix:** give bids a deterministic id — `` doc(db, 'activeBids', `${itemId}_${uid}`) `` — so a
second open offer is a conflict, and add a `getAfter`/counter check in rules (or a small callable)
for per-user daily caps on questions and bids.

### 10. Bids can be deleted after the trade is closed

`firestore.rules:185-187` allows either participant to delete a bid in any status, and
`MyBids.tsx:214-228` exposes "Withdraw offer" for exactly that. Once `Completed`, that document
is the only record of the trade — deleting it removes the counterparty's ability to rate, and any
future dispute/refund evidence.

**Fix:** `allow delete: if isBidParticipant() && resource.data.status == 'Pending'` and, for
closed bids, either keep them immutable or replace deletion with a `withdrawnAt` soft-delete
field.

### 11. Ratings are not tied to a completed trade

`firestore.rules:30-42` (`isRatingAppend`) only requires that the rater is signed in, is not the
target, writes one 1–5 number under their own UID and has not rated before. Nothing checks that
a `Completed` bid exists between the two users. The UI restricts the button (`MyBids.tsx:263`),
so this is a "custom client" attack — one rating per pair, which is still enough to poison a new
user's reputation downward.

**Fix:** move rating creation into a callable that verifies a `Completed` bid containing both
UIDs, writes `users/{ratedUid}/ratings/{raterId}` as its own document (with `bidId`, `createdAt`),
and derives the average in the function or a scheduled aggregation. Rules then become
`allow write: if false` on that subcollection. This also removes the unbounded `ratings` map from
a document that every profile read has to fetch.

### 12. Amount verification is too strict in one direction and absent in the other

`umnotho/functions/src/payments.ts:253-265`:

```ts
if (typeof event.amountUsdt === 'number' &&
    Math.abs(event.amountUsdt - expectedUsdt) > Math.max(0.01, expectedUsdt * 0.02)) {
  /* status: 'failed' */
}
```

- a customer who sends slightly **more** than quoted is marked `failed` and loses the payment;
- if the provider payload omits the amount, the check is skipped entirely and any signed `paid`
  event activates a plan.

**Fix:** require the amount (`if (typeof event.amountUsdt !== 'number') → 'failed' + alert`),
treat `event.amountUsdt >= expectedUsdt` as settled (overpayment is a support/credit issue, not a
failure), and only reject underpayment beyond tolerance. Ideally also verify asset/network
(`pay_currency`, `payin_hash`) rather than amount alone.

### 13. Nothing expires or reconciles `pending` payments

`expiresAt` is only acted on when a webhook happens to arrive. A user who abandons checkout
leaves a `pending` document forever; a payment that the provider never calls back about is
invisible. There is no scheduled job and no admin view.

**Fix:** add a `onSchedule` function that (a) marks `pending` documents older than
`expiresAt + grace` as `expired`, and (b) for anything `pending`/`confirming` older than ~1 hour,
queries the provider's payment status and settles it. That single job also covers cases 2 and 3.

### 14. Plan changes and renewals have undefined semantics

`payments.ts:279-283` extends from the current expiry when it is in the future, otherwise from
`now`, and always writes `subscriptionStartedAt: now`. Consequences:

- upgrading Basic → Biz mid-period charges the full Biz price but keeps the old expiry;
- downgrading Biz → Basic immediately truncates the remaining Biz days;
- `subscriptionStartedAt` is overwritten on every extension, so "member since" style reporting is
  wrong.

**Fix:** decide and encode the policy (most consumer-friendly: new expiry = old expiry + new
duration; tier upgrade takes effect immediately; downgrade takes effect at expiry). Keep
`subscriptionStartedAt` as the *first* activation and add `subscriptionRenewedAt`.

### 15. Plan prices are duplicated between client and server

`src/components/Pricing.tsx:34-70` hard-codes `R 49` / `R 97`, `plans.ts:16-29` holds the
authoritative `amountZar`. Raising a price in one place silently produces a UI that advertises a
different number from the one charged.

**Fix:** expose a `getPlans` callable (or a public `plans` document) and render the server
catalogue. As a minimum, import a single shared constant module into both bundles.

### 16. Checkout polling never stops

`Pricing.tsx:113-131` polls `getCryptoCheckout` every 5 s while `status === 'pending'`. It keeps
polling after the local `expiresAt` has passed (the `expired` flag at line 221 is only used for
rendering), while the tab is hidden, and without backoff. On a mobile connection this is a
steady stream of callable invocations for a checkout the user has abandoned.

**Fix:** stop the interval when `checkoutIsExpired(...)` or after N attempts, add exponential
backoff (5s → 15s → 30s), and gate on `document.visibilityState`.

### 17. Mojibake in user-visible strings

Ten strings are UTF-8 double-encoded, e.g. `Barter.tsx:753` renders **"Postingâ€¦"** instead of
"Posting…", `Barter.tsx:466` shows `Â·` instead of `·`, and `MyBids.tsx:244` shows
"Thanks â€” your rating…". `Profile.tsx:96` uses the correct characters, so the corruption came
from a Windows editor at some point.

Affected: `Barter.tsx:412, 466, 486, 753, 786, 804`, `MyBids.tsx:244, 325, 410, 568`.

**Fix:** replace with the intended characters and add `.editorconfig` (`charset = utf-8`) plus
`* text=auto eol=lf` in `.gitattributes` so it cannot regress. A grep for `â€|Â` is worth adding
to CI once it runs.

### 18. Accessibility of dialogs and navigation

- Every modal (`Barter.tsx:646`, `Barter.tsx:763`, `MyBids.tsx:514`, `Pricing.tsx:351`) sets
  `role="dialog" aria-modal="true"` but has no focus trap, no initial focus, no Escape handler
  and no focus restoration. Keyboard users can tab into the page behind the overlay.
- `LandingPage.tsx:16` makes a `div` clickable (`onClick={() => navigate('/')}`) — not focusable,
  no role/keyboard handler.
- `AppNav` uses `<button onClick={() => navigate(...)}>` for navigation instead of `<Link>`, so
  middle-click/open-in-new-tab and crawler discovery do not work.
- The motion-heavy hero and cards ignore `prefers-reduced-motion`.

**Fix:** use `<dialog>` or a small `useFocusTrap` hook with Escape handling; `<Link>`/`<NavLink>`
for navigation; `useReducedMotion()` from `motion` to drop entrance animations.

### 19. No Content-Security-Policy

`firebase.json:11-41` sets HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and
COOP — a good set — but no `Content-Security-Policy`. For an app that renders user-generated
listing text and questions, CSP is the cheapest XSS mitigation available.

**Fix:** start in report-only and tighten. A workable baseline for Firebase Auth
(popup/redirect + `identitytoolkit` + Firestore/`firestore.googleapis.com`):

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com;
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.cloudfunctions.net;
frame-src 'self' https://*.firebaseapp.com https://accounts.google.com;
img-src 'self' data:;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
object-src 'none'; base-uri 'self';
```

(Your Tailwind build injects styles at runtime today, hence `'unsafe-inline'` for styles; the
Google Fonts entries can be dropped if you self-host Inter/Space Grotesk.)

### 20. Test coverage gaps

What exists is good: rules tests cover the main actor matrix (`tests/rules/firestore.rules.test.ts`),
and the Functions tests cover quoting, status mapping and IPN signatures. Missing:

- **No component tests at all** — `vitest.config.ts:6` only includes `src/**/*.test.ts`, so the
  `.tsx` components can never be picked up. There is no testing-library dependency.
- **No tests for the money path**: `settlePayment`, `createCheckout`, `handleWebhook`,
  `assertCheckoutRateLimit` have zero coverage. Cases 2, 3, 4, 12, 13 would all have been caught
  by a test that feeds a `finished` event after `expiresAt`.
- **Rules gaps**: outsider updating a bid, non-owner deleting a listing, `users` *list* queries,
  the 50-inquiry cap, message length limits, and the `payments` list behaviour.
- No end-to-end emulator test of the sandbox checkout flow.

**Fix:** add `functions/src/payments.test.ts` with the Firestore emulator
(`@firebase/rules-unit-testing` already present) covering: idempotent double IPN, late IPN after
expiry, amount mismatch, unknown plan, and rate-limit exhaustion.

### 21. `scripts/rotate-secrets.sh` is broken and dangerous

`umnotho/scripts/rotate-secrets.sh` is a 162-line emergency script that would do real damage:

- **line 116-120** — `java -jar bfg.jar --delete-files '*.{key,json,pem,p12,pfx}'` deletes
  **every** history version of **every** `.json` file: `package.json`, `package-lock.json`,
  `firestore.indexes.json`, `firebase.json`, `tsconfig*.json`. The repository would no longer
  build from history.
- **line 124** — `git gc --prune=now --aggressive` after that is unrecoverable.
- **line 118** — `--replace-text .gitleaks.toml` is wrong; BFG expects a plain `old==>new` file.
- **line 113** — BFG must run against a bare mirror; it is invoked on the working tree, and the
  `backup.git` mirror is created inside the repository being rewritten.
- **line 46** — points at `src/firebaseConfig.ts`, which does not exist.
- **line 44** — "Add fingerprint or Regenerate secret" is not how Firebase Web API keys work
  (they are public identifiers; you restrict them by HTTP referrer/API, or delete the key and
  create a new one).
- **line 99** — wrong repository URL (`github.com/umnothobiz/umnotho`).
- **line 74** — writes `./$SA_NAME-key.json` into the current directory; `.gitignore` covers
  `*.key` and `service-account*.json` but **not** `*-key.json`.

**Fix:** delete the script and replace it with a short, tested runbook in SECURITY.md
(revoke key in Google Cloud → create replacement → `firebase functions:secrets:set` → update
GitHub environment secrets → re-deploy). If you keep BFG, scope it to the specific blobs
(`bfg --delete-files 'service-account-*.json'`) run against a fresh mirror clone.

### 22. `security-monitor.js` reports on a script that does not exist

`scripts/security-monitor.js:102-105` runs `npm run lint:security`, which is not in
`package.json` — so that check is permanently "warning". It also audits only the root package,
not `functions/`, and builds shell strings for `execSync` (fine today because they are constant,
but it is a pattern to avoid).

**Fix:** call `eslint` with the security config directly, audit both manifests
(`npm audit --omit=dev` and `npm --prefix functions audit --omit=dev`), and drop the shell-string
helper in favour of `execFile`.

### 23. Secret scanning is configured but never executes

`umnotho/.pre-commit-config.yaml` sits next to the workflows — `pre-commit` looks for
`.pre-commit-config.yaml` at the git root, so the hook never installs. `.gitleaks.toml`'s
allowlist is also stale: it exempts `test/`, `__tests__/`, `__mocks__/`, `SECURITY-SETUP.md` —
none of which exist here (tests live in `tests/`), while `.env.example` placeholders are *not*
exempted and will trip `firebase-api-key`/`env-secrets`.

Good news: I found no committed credentials (`git grep` for `AIza…`, `PRIVATE KEY`,
`service_account` returns nothing), and `.gitignore` is thorough.

**Fix:** move `.pre-commit-config.yaml` to the root, fix the allowlist paths, add
`gitleaks detect --no-git` (or the `gitleaks` action) to CI, and run it over full history once.

### 24. Documentation drift

- `README.md:220` shows `vite.config.ts` and `docs/` under `umnotho/`; `docs/` is at the root
  and `umnotho/` has no `docs/` directory.
- Contact address is `bongytech@gmail.com` in README/SECURITY but `bongy.tech@gmail.com` in
  `LegalPage.tsx:106,151` — one of them will not reach you.
- `README.md:276-284` and `SECURITY.md:138-152` describe CI that does not run (finding 1).
- `README.md:34-36` says "A Cloud Function verifies the payment and activates the plan" — true
  once deployed, but the pricing page's "R 49 /month" implies recurring billing; there is no
  auto-renew (`LegalPage.tsx:145` says so explicitly). Align the pricing copy with "30 days, one
  off" to avoid a consumer-protection complaint.
- `DEVELOPMENT.md:269` references `.github/workflows/ci.yml` as if it were at the root.

**Fix:** a docs pass after fixing 1; add a CI job that fails when `npm run lint`/`typecheck`
disagree with what the docs promise (or simply keep the quick-start commands in one place).

### 25. Small correctness/robustness nits worth cleaning up

- `rateLimit.ts:38` throws `new Error('rate-limited')` and `payments.ts:100` matches on the
  message string. Throw a typed `PaymentError('rate-limited', …)` instead.
- `payments.ts:56-78` (`toResponse`) casts `data.status as CheckoutResponse['status']` and
  `data.plan as PlanId` without validation; a hand-edited or legacy document flows straight into
  the UI. Validate with `isPaymentStatus`/`isPlanId` and coerce unknown to `failed`.
- `index.ts:108-110` hard-codes provider header names (`x-nowpayments-sig`) in the generic
  webhook; pass the header to the adapter (`parseWebhook(rawBody, headers)`) so a second provider
  does not require editing the entry point.
- `payments.ts:234-241`: a `pending` event on a payment that is already `expired` cannot
  resurrect it; fine, but combine with finding 2 so `paid` can.
- `Barter.tsx:157` sorts by `createdAt` client-side after downloading everything — move to the
  query (`orderBy('createdAt', 'desc')`).
- `Barter.tsx:58` and `MyBids.tsx:44` fall back to `'Trader'`/`Trader 1234` placeholders for
  `senderName`; since the rules let a client set an arbitrary `senderName`, add a note that
  display names in messages/questions are not trustworthy identity.
- `AuthContext.tsx:102-119`: `signUp` creates the Auth user, then updates the profile, then sends
  verification. If `updateDoc` is rejected (e.g. a 0-character username slips past the client
  check), the account exists but the call rejects — the user sees "Authentication failed" and
  cannot easily retry. Validate the username in `signUp` (`trim().length >= 2`) and treat the
  profile write as best-effort with a retry.

### 26. The signup success notice is never shown

`Auth.tsx:56-59` sets `notice` ("Account created. Check your inbox…") and then immediately
`navigate(from)`, unmounting the component. Move the message to the destination route (e.g. a
`?welcome=1` flag or a toast) or navigate only after the user dismisses it.

---

## What is already good (keep it)

- **Rules are deny-by-default and schema-checked** — field allow-lists, size limits, append-only
  arrays and map-keyed votes/ratings are a genuinely thoughtful design, not a `allow read, write:
  if true` demo.
- **Payments are correctly one-way**: the browser can read its own payment and nothing else;
  prices, durations and the quote are server-side; activation happens in a transaction with
  `merge: true` on the user document.
- **Secret hygiene**: no credentials in history, `.env*` ignored, `VITE_`-only public config, and
  the docs explain why the Firebase web config is not a secret. The startup screen that explains
  missing configuration (`main.tsx` + `StartupError.tsx`) is a nice touch that prevents the
  classic blank-page issue.
- **Docs**: `docs/crypto-payments.md` and SECURITY.md are honest about limitations — rare and
  valuable. The "known limitations" list is exactly what a reviewer wants to see.
- **Dependency posture**: production audit is clean, lockfiles committed, `npm ci` used.

---

## Suggested order of work

1. **Move `.github` to the repository root** and get CI green (findings 1, 23, 24). Everything
   else is cheaper once the safety net exists.
2. **Fix the money path** (2, 3, 4, 12) and add the reconciliation job (13) plus the missing
   `settlePayment` tests (20). This is the only area where a bug costs real money.
3. **Lock down the sandbox escape hatch** (5) and tighten `users` reads (6).
4. **Structural abuse fixes**: deterministic bid ids, delete-after-close restriction, server-side
   ratings (9, 10, 11).
5. **Scale/performance**: pagination, query-side filters, split inquiries (8, 16).
6. **Polish**: encoding (17), a11y (18), CSP (19), docs (24), remove/rewrite `rotate-secrets.sh`
   (21, 22).

---

*Review performed by reading the full source at `31e1f2d`, running lint/typecheck/audit locally,
and querying the GitHub API for workflow registration. Unit and rules tests could not be executed
in the review environment (esbuild sandbox restriction); that is an environment limitation, not a
finding against the repository.*
