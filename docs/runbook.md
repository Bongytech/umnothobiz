# Operations runbook

What to do when something is broken, and the one-time setup that makes these
steps possible. Written for a single maintainer: every instruction assumes you
have repository admin, Firebase console access and the `gcloud`/`firebase` CLIs
on your machine.

Related: [DevOps and DevSecOps](./devops.md) for how the pipelines work,
[SECURITY.md](../SECURITY.md) for the threat model.

## First five minutes

| Symptom | Check first | Then |
| :--- | :--- | :--- |
| Site returns 5xx or blank | Firebase Hosting release history | Roll back Hosting ([below](#roll-back-hosting)) |
| "Missing or insufficient permissions" everywhere | Last `firestore.rules` deploy | Revert that commit and redeploy rules |
| Checkout button fails | Cloud Functions logs (`cryptoWebhook`, `createCheckout`) | Check `CRYPTO_PROVIDER`, provider status, secrets |
| Users report paid but no subscription | Functions logs for settlement errors, Firestore `payments` docs | Reconcile with the provider dashboard; never hand-edit `subscriptionTier` without a note |
| Unexpected Firestore writes or spend | Firestore usage graphs, Audit Logs | Disable the deploy path, rotate credentials, follow [data exposure](#suspected-data-exposure) |

Severity guide: **SEV1** = site down, wrong money movement, or data exposed.
**SEV2** = a feature broken for everyone. **SEV3** = degraded edge case. Only
SEV1 warrants stopping other work immediately.

## Which environment am I looking at?

| Environment | URL | Project |
| :--- | :--- | :--- |
| Production | <https://umnothobiz.web.app> | `umnotho-f71ba` |
| UAT | <https://umnotho-uat.web.app> | `umnotho-uat` |
| Staging | <https://umnotho-staging.web.app> | `umnotho-staging` |

Staging and UAT are separate Firebase projects: a bad staging deploy cannot touch
production data, and a rules rollback in UAT does not affect production. Always
confirm the project id before running a `firebase` command — the console and CLI
remember the last project you selected.

## Promote a release

```
merge to main ──► staging deploys automatically (watch the smoke test)
tag vX.Y.Z    ──► UAT deploys automatically (verify the flow)
production    ──► next CI run, or re-run "Deploy", once UAT is signed off
```

1. Merge to `main`. Wait for `Deploy staging` to go green (it smoke tests the
   staging URL and its headers).
2. Click through staging, including the payment path if it changed.
3. Tag the release: `git tag v1.2.3 && git push origin v1.2.3`. `Deploy UAT`
   verifies the commit is on `main`, deploys to `umnotho-uat` and smoke tests it.
4. UAT sign-off: run the acceptance checks against <https://umnotho-uat.web.app>.
5. Production: if `REQUIRE_UAT_SIGNOFF=true`, the production deploy that followed
   your merge will have skipped with a notice. Re-run **Deploy** (or push nothing
   and use *Run workflow*) once UAT passed.

Hotfix: fix on a branch, merge, verify staging, then `workflow_dispatch` the
production deploy — it bypasses the UAT gate by design, so say why in the PR.

## Roll back Hosting

Works per environment; use the project id of the environment you are fixing.

Fastest, no commit needed:

1. Firebase console → Hosting → release history → pick the last known-good
   release → **Roll back**.
2. Confirm with `curl -I https://umnothobiz.web.app/` (or the UAT/staging URL)
   and a hard refresh.

Equivalent from the CLI:

```bash
firebase hosting:rollback --project umnotho-f71ba      # production
firebase hosting:rollback --project umnotho-uat        # UAT
firebase hosting:rollback --project umnotho-staging    # staging
```

Then fix forward on `main`. A revert commit is still required, otherwise the
next deploy re-ships the broken build.

## Roll back Firestore rules or indexes

Rules deploy with the app, so a broken rule set is a broken commit:

```bash
git revert <bad-commit>          # or fix the rule
git push                          # CI runs, then Deploy re-deploys rules
```

If CI itself is broken and you need rules back immediately, deploy from a clean
checkout of the last good commit, using that environment's config and project:

```bash
git checkout <good-commit>
cd umnotho
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
  npx --yes firebase-tools@15 -c firebase.json deploy \
  --only firestore:rules,firestore:indexes --project umnotho-f71ba   # production
# staging: -c firebase.staging.json --project umnotho-staging
# UAT:     -c firebase.uat.json     --project umnotho-uat
```

Indexes rebuild in the background; queries that need a missing index fail with
`failed-precondition` until they finish.

## Roll back Cloud Functions

Functions v2 run on Cloud Run, so the fastest rollback is a traffic shift:

1. Google Cloud console → **the right project** (`umnotho-f71ba`, `umnotho-uat`
   or `umnotho-staging`) → Cloud Run → the function's service (for example
   `cryptowebhook`) → **Revisions**.
2. Send 100% of traffic to the previous healthy revision.

For a permanent fix, revert the commit and let that environment's deploy
re-deploy. Deleting a function outright is the last resort — the webhook URL
disappears and the payment provider will retry against a 404.

## Stop payments immediately (kill switch)

Pick the smallest lever that solves the problem. Each applies **per environment**:
stopping payments in UAT does not affect production, and vice versa.

| Lever | Effect | Latency |
| :--- | :--- | :--- |
| Cloud Run traffic shift to a revision without the payment code | Checkout and webhook stop moving money | Seconds |
| Remove `CRYPTO_PROVIDER` and redeploy Functions in that environment | `createCheckout` refuses new sessions there | One deploy |
| Remove `CRYPTO_PROVIDER` from that environment's variables in GitHub | Stops future Functions deploys (not the running one) | Next deploy |
| Firestore rules deny `payments` reads | Hides history, does not stop settlement | One rules deploy |

Always reconcile afterwards: a stopped checkout can leave a provider invoice
that the customer may still pay. Check the provider dashboard for payments
created in the affected window and settle or refund them by hand.

## Rotate credentials

Secrets are scoped per GitHub Environment. Rotate the key in the Firebase/Google
project it belongs to, then update the secret on that environment only — never
copy a production key into staging or UAT.

### Firebase deploy service account

1. Google Cloud console → IAM → Service accounts → the deploy account → Keys →
   **Add key** (JSON).
2. Update `FIREBASE_SERVICE_ACCOUNT` on that GitHub Environment (`production`,
   `uat` or `staging`).
3. Run that environment's deploy manually (`workflow_dispatch`) to prove the new
   key works.
4. Disable, then delete the old key. Never leave two valid keys.

### NOWPayments API key and IPN secret

Use sandbox/test credentials in staging and UAT; never reuse production keys
there.

1. Rotate both values in the NOWPayments dashboard.
2. Update Firebase secrets in the matching project, then redeploy Functions so the
   new versions bind:

   ```bash
   firebase functions:secrets:set NOWPAYMENTS_API_KEY --project umnotho-f71ba
   firebase functions:secrets:set NOWPAYMENTS_IPN_SECRET --project umnotho-f71ba
   ```

3. Send a test webhook from the provider dashboard and confirm it returns 200 and
   settles exactly once.

### Firebase web API key (`VITE_FIREBASE_API_KEY`)

This is a public identifier, not a secret, but it can be abused through quota:

1. Google Cloud console → APIs & Services → Credentials → rotate the browser key.
2. Update `VITE_FIREBASE_API_KEY` on that environment and redeploy Hosting.
3. Apply HTTP-referrer and API restrictions on the new key; enable App Check.

### If a credential leaks

Assume it is already scraped — a public repository's history is public the moment
it is pushed.

1. **Revoke first** (rotate the key). Do not spend time on history until the
   credential is dead.
2. Rotate every credential in the same blast radius (provider key + IPN secret +
   deploy key if the file contained them).
3. Purge history only if the secret cannot be rotated:
   `git filter-repo --path <file> --invert-paths`, force-push, then ask GitHub
   Support to garbage-collect. Every clone must be re-cloned afterwards.
4. Record what happened in the incident notes and update `.gitleaks.toml` if the
   pattern was not caught.

The push-protection and secret-scanning alerts in **Settings → Code security**
are the detection layer; the pre-commit hook is the cheap prevention layer.

## Suspected data exposure

1. Identify the collection and the rule that allowed it. Firestore rules are the
   only server-side authorization for client reads.
2. Close the hole with a targeted rules change and deploy it (rules deploy in
   seconds, before the app rebuild finishes).
3. Determine the exposure window from Audit Logs / Firestore usage and the
   affected user documents.
4. Notify affected users (POPIA applies — South African users' personal data).
   Do not wait for a complete technical picture before notifying.
5. Preserve logs; do not delete collections during triage.

## Monitoring and alerting (one-time setup)

Nothing pages anyone yet; the repository sets up the deploy path, not the
observability stack. Configure these once, in order of value:

| Control | Where | Why |
| :--- | :--- | :--- |
| Uptime check on `https://umnothobiz.web.app` | Cloud Monitoring (1 min, 3 regions) | Detects a bad Hosting deploy within a minute |
| Uptime checks on the UAT and staging URLs | Cloud Monitoring, lower frequency | Keeps the sign-off environments honest; these do not need to page overnight |
| Budget alert | Google Cloud Billing → Budgets (e.g. R100 and R500) | Cloud Functions and Cloud Run bill per use — and staging/UAT add projects |
| Error Reporting notifications | Google Cloud → Error Reporting (each project) | Surfaces uncaught Function errors |
| Log-based alert on settlement failures | Cloud Logging → Logs-based alerts (`settlement` / `webhook` severity >= ERROR) | Payments that failed silently |
| Firestore daily backup | Firestore → Backups, plus a retention policy, **per project** | Recovery from accidental deletion |
| Provider status page | NOWPayments status | Distinguishes provider outage from our bug |

Add the uptime check URL to `deploy.yml`'s smoke test (`SITE_URL`) if the custom
domain changes.

## Backup and restore

- Enable Firestore **scheduled backups** (daily, 14-day retention) and point-in-time
  recovery if the plan allows.
- Test a restore into a throwaway project once a quarter. An untested backup is a
  guess.
- The repository is the source of truth for rules, indexes and Functions; the data
  is the only thing that cannot be rebuilt from git.

## After every SEV1 or SEV2

Write a short note — what broke, what the user saw, the root cause, the fix, and
what would have caught it earlier. Add a test or a check when the answer is
"nothing would have". Keep it in the pull request or the incident thread; the
goal is a durable record, not paperwork.
