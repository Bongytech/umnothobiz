# Post-merge remediation plan — `Bongytech/umnothobiz`

Companion to the code review of `main @ 31e1f2d`. Prioritised by risk of financial
loss and data exposure, not by finding number.

**Gate:** until P0 is complete, live crypto checkout stays disabled, or the UI states
plainly that payments are not production-ready.

---

## P0 — Contain immediate risk

- [ ] **Close the sandbox-to-free-subscription path** (finding 5). Require sandbox
      payments to run only in the emulator or an explicitly allowlisted
      non-production project. Audit deployed environment settings and disable
      sandbox access in production.
- [ ] **Protect settlement against lost payments** (findings 2, 3, 4, 12).
      - Handle a verified paid event even if it arrives after the local expiry.
      - Create the pending payment record *before* requesting an invoice.
      - Return 5xx for transient settlement failures.
      - Require a valid payment amount while accepting overpayments for follow-up
        rather than discarding them.
- [ ] **Restore payment cleanup and reconciliation** (finding 13; related to the
      removed expiry function). Expire abandoned checkouts and reconcile older
      pending payments against provider status. Alert on late payments, missing
      amounts, and settlement failures.
- [ ] **Remove or disable the dangerous secret-rotation script** (finding 21). Do
      not run it as written. Replace it with a reviewed runbook and verify any
      alternative against a disposable mirror first.

**Exit criteria:** automated tests cover late and duplicate webhooks, provider/Firestore
failures, amount handling, and idempotent settlement; production cannot use the sandbox
provider; pending payments have an expiry and reconciliation path.

---

## P1 — Establish a working safety net and protect personal data

- [ ] **Fix CI and deployment discovery** (findings 1, 23, 24). Move GitHub
      workflows, Dependabot, and pre-commit configuration to the repository root;
      configure commands for the app's `umnotho/` directory; make CI run lint,
      typecheck, tests, build, rules tests, and secret scanning.
- [ ] **Restrict access to private profile data** (finding 6). Stop allowing
      signed-in users to enumerate profiles containing email addresses; separate
      public profile fields from private contact data or enforce owner-only reads.
- [ ] **Implement and document account deletion** (finding 7). Add a deletion
      workflow that handles Auth, user-owned content, references in trade history,
      and payment-retention obligations; align the privacy notice with the actual
      process.
- [ ] **Keep production credentials in Secret Manager** (finding 5 and the review
      note). Limit dotenv credentials to local/non-production use and verify
      deployed configuration before enabling provider-backed checkout.

**Exit criteria:** GitHub reports the expected workflows and they pass; rules tests
demonstrate that users cannot list or read other users' private data; deletion behaviour
and payment-record retention are documented and tested.

---

## P2 — Preserve trade and reputation integrity; reduce abuse

- [ ] **Make bids structurally unique and preserve closed-trade records**
      (findings 9, 10). Use deterministic bid ids or an equivalent server-side
      uniqueness guarantee, and prevent deletion of completed or declined trade
      records.
- [ ] **Tie ratings to completed trades** (finding 11). Verify eligibility
      server-side and store rating records separately from the public profile
      summary.
- [ ] **Add abuse controls** (finding 9). Apply server-enforced quotas to bids,
      questions, and messages; do not rely on client-side duplicate checks or rate
      limits.

**Exit criteria:** rules and callable tests cover duplicate submissions, quota limits,
unauthorised ratings, and attempts to delete closed trade history.

---

## P3 — Control cost and clarify billing behaviour

- [ ] **Bound and paginate Firestore listeners** (finding 8). Start with a capped,
      ordered query and add pagination and server-side filters where needed.
      Consider moving high-churn inquiries out of listing documents.
- [ ] **Stop abandoned checkout polling** (finding 16). Stop at expiry or a maximum
      attempt count, back off between requests, and pause while the tab is hidden.
- [ ] **Define plan-change and renewal semantics** (finding 14), then make the
      pricing page accurately state that plans are one-off 30-day purchases unless
      auto-renew is actually implemented.
- [ ] **Use one source for plan prices** (finding 15), so displayed prices and
      server-charged prices cannot drift.

**Exit criteria:** no unbounded listener remains; checkout polling terminates on every
path; pricing copy matches the billing behaviour the code implements; a price change
requires editing one file.

---

## P4 — Polish, accessibility, and maintainability

- [ ] **Fix mojibake and add UTF-8/line-ending configuration** (finding 17).
- [ ] **Improve modal focus management, keyboard navigation, semantic links, and
      reduced-motion behaviour** (finding 18).
- [ ] **Add a CSP in report-only mode first**, then tighten it based on observed app
      requirements (finding 19).
- [ ] **Repair the security-monitor script and stale documentation/contact details**;
      add checks for user-visible encoding regressions (findings 22, 24, 25).
- [ ] **Move the signup success message** to a destination-page toast or equivalent
      (finding 26).

**Exit criteria:** no user-visible encoding defects; keyboard-only users can complete
every modal flow; CSP ships in report-only without unexplained violations; docs match
the repo layout and the real contact address.

---

## Release gates

| Gate | Condition |
| :--- | :--- |
| Live crypto payments | **P0 complete** |
| "Production-ready" claim | **P0 + P1 complete** |
| Barter transactions at scale | P2 trade-history and rating protections treated as launch blockers |

P2–P4 can be tracked as follow-up milestones.

---

## Appendix — where each item lives in the code

Concrete anchors for the person implementing this, so nothing needs re-discovery.

### P0

| Item | Files | Notes |
| :--- | :--- | :--- |
| Sandbox lockdown (5) | `umnotho/functions/src/provider.ts:13-19`, `payments.ts:173-179` | `sandboxAllowed()` returns true on `ALLOW_SANDBOX_PAYMENTS` alone; add a project/emulator allowlist check |
| Late paid event (2) | `payments.ts:219-251` | expiry branch at 229-232 returns before the `paid` branch |
| Write doc before invoice (3) | `payments.ts:109-148` | `provider.createCheckout()` at 116 precedes `paymentRef.set()` at 147 |
| Webhook 400 vs 5xx (4) | `umnotho/functions/src/index.ts:103-117` | single catch → always 400 |
| Amount handling (12) | `payments.ts:253-265` | `typeof event.amountUsdt === 'number'` guard skips verification; overpayment marks `failed` |
| Reconciliation (13) | new `umnotho/functions/src/reconcile.ts` | `onSchedule`, plus `expiresAt` sweep and provider status lookup |
| Rotation script (21) | `umnotho/scripts/rotate-secrets.sh` | delete; BFG invocation at 116-120 would purge every JSON blob in history |

Suggested tests (`umnotho/functions/src/payments.test.ts`):

1. `finished` IPN after `expiresAt` → `paid`, plan extended.
2. duplicate `finished` IPN → single extension, no double-charge.
3. Firestore/transaction failure during settlement → webhook responds 500.
4. missing `actually_paid` → `failed`, not activated.
5. overpayment → `paid`, flagged for follow-up.
6. `ALLOW_SANDBOX_PAYMENTS=true` with a production project id → `unavailable`.

### P1

| Item | Files |
| :--- | :--- |
| CI discovery (1) | `umnotho/.github/workflows/*.yml` → `.github/workflows/*.yml` + `working-directory: umnotho`; `entryPoint: umnotho` for hosting-deploy |
| Dependabot (1) | `umnotho/.github/dependabot.yml` → `.github/dependabot.yml`, directories `/umnotho` and `/umnotho/functions` |
| Pre-commit / gitleaks (23) | `umnotho/.pre-commit-config.yaml` → root; fix `.gitleaks.toml` allowlist paths (`test/` → `tests/`) |
| Profile exposure (6) | `umnotho/firestore.rules:46`; `src/contexts/AuthContext.tsx:42-47` |
| Account deletion (7) | `umnotho/firestore.rules:65`; new callable; `src/components/LegalPage.tsx:97-110` |

### P2

| Item | Files |
| :--- | :--- |
| Unique bids (9) | `umnotho/firestore.rules:153-179`; `src/components/Barter.tsx:286-322` |
| Closed-trade deletion (10) | `umnotho/firestore.rules:185-187`; `src/components/MyBids.tsx:214-228` |
| Ratings (11) | `umnotho/firestore.rules:30-42`; `src/components/MyBids.tsx:230-258` |

### P3

| Item | Files |
| :--- | :--- |
| Listeners (8) | `src/components/Barter.tsx:130-146`; `MyBids.tsx:101-144`; `Profile.tsx:67-73` |
| Polling (16) | `src/components/Pricing.tsx:113-131` |
| Plan semantics (14) | `umnotho/functions/src/payments.ts:276-304` |
| Price source (15) | `src/components/Pricing.tsx:34-70`; `umnotho/functions/src/plans.ts:16-29` |

### P4

| Item | Files |
| :--- | :--- |
| Encoding (17) | `src/components/Barter.tsx:412,466,486,753,786,804`; `MyBids.tsx:244,325,410,568`; add `.editorconfig`, `.gitattributes` |
| A11y (18) | `Barter.tsx:646,763`; `MyBids.tsx:514`; `Pricing.tsx:351`; `LandingPage.tsx:16`; `AppNav.tsx:43-56` |
| CSP (19) | `umnotho/firebase.json:11-41` |
| Tooling/docs (22, 24, 25) | `scripts/security-monitor.js:102-105`; `README.md:220,301`; `LegalPage.tsx:106,151` |
| Signup notice (26) | `src/components/Auth.tsx:56-59` |
