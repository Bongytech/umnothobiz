# DevOps and DevSecOps

How this repository is built, tested, scanned and deployed, and what a
maintainer has to do by hand. If you only read one section, read
[Deployment flow](#deployment-flow) and
[Repository settings as code](#repository-settings-as-code).

## Environments

| Environment | What it is | How it is reached |
| :--- | :--- | :--- |
| Local | Vite dev server plus the Firebase emulator suite (`npm run emulators`) | `npm run dev` |
| Preview | One temporary Firebase Hosting channel per pull request (`pr-<number>`), deleted after 7 days | Automatic on pull requests from this repository |
| Production | Firebase Hosting live channel at <https://umnothobiz.web.app>, project `umnotho-f71ba` | Merge to `main`, after CI passes |

There is **no separate staging project**. Firestore rules are verified by the
emulator in CI, and every pull request gets a preview build. Anything that needs
real credentials must be verified in production, so keep changes small and
reversible.

## Pipeline overview

```
pull request ──► CI (lint, typecheck, unit, rules, functions, audit, secrets, dependency review)
             └─► CodeQL (SAST)
             └─► Preview (Firebase Hosting preview channel)

main push ─────► CI ──(green)──► Deploy
                                  ├─ build with production config
                                  ├─ deploy Firestore rules + indexes
                                  ├─ deploy Cloud Functions (when CRYPTO_PROVIDER=nowpayments)
                                  ├─ deploy Hosting (live)
                                  └─ smoke test: HTTP 200 + security headers

weekly ────────► Security scan (full-history secrets, dependency audit, SBOM)
             └─► CodeQL
```

| Workflow | File | Trigger | Gate for production |
| :--- | :--- | :--- | :--- |
| CI | `.github/workflows/ci.yml` | push to `main`, all PRs, manual | **Yes** – Deploy only runs after a green CI run |
| Deploy | `.github/workflows/deploy.yml` | `workflow_run` of CI on `main`, manual | – |
| Preview | `.github/workflows/preview.yml` | PR opened/updated (same repository only) | No |
| CodeQL | `.github/workflows/codeql.yml` | `main`, PRs, weekly | Advisory (results in the Security tab) |
| Security scan | `.github/workflows/security.yml` | weekly, manual | Advisory |

CI jobs and the check names they publish:

| Job | Check name in branch protection |
| :--- | :--- |
| quality | `Lint, typecheck, test, build` |
| rules | `Firestore security rules` |
| functions | `Cloud Functions` |
| audit | `Dependency vulnerability audit` |
| secrets | `Secret scan` |
| dependency-review | `Dependency review (advisory)` — reported, not required |
| (CodeQL) | `Analyze JavaScript/TypeScript` |

If you rename a job, update `CHECK_NAMES` in
[`scripts/ops/apply-branch-protection.mjs`](../scripts/ops/apply-branch-protection.mjs)
and re-run it, otherwise the old required check blocks every merge forever.

## Deployment flow

`Deploy` is triggered by CI finishing, not by the push itself, so a red test,
audit or secret scan can never reach production. The job:

1. Checks out the exact commit CI tested (`workflow_run.head_sha`).
2. Builds with the production `VITE_FIREBASE_*` configuration.
3. Exits cleanly, with a notice, when `FIREBASE_SERVICE_ACCOUNT` or
   `VITE_FIREBASE_PROJECT_ID` is missing. A fresh clone therefore does not fail
   every push to `main`.
4. Deploys `firestore.rules` and `firestore.indexes.json` before the app, so
   rules can never lag behind the code that depends on them.
5. Deploys Cloud Functions only when the repository variable
   `CRYPTO_PROVIDER=nowpayments` is set.
6. Deploys the `live` Hosting channel.
7. Smoke tests the site: retries until HTTP 200, then asserts
   `Strict-Transport-Security`, `X-Content-Type-Options` and `X-Frame-Options`
   are still sent. A failed smoke test marks the run red even though the upload
   succeeded.

Manual deploys are allowed with `workflow_dispatch` (Actions → Deploy → Run
workflow) for cases where you need to re-ship the current `main` without a new
commit. That path still builds and smoke tests, but it does not re-run CI —
prefer pushing a commit.

### What each deploy can and cannot break

| Step | Blast radius | Recovery |
| :--- | :--- | :--- |
| Hosting | The served frontend | Firebase Hosting release history → roll back |
| Firestore rules | Every read/write path | Revert the commit and redeploy rules (seconds) |
| Indexes | Query performance / `failed-precondition` | Revert and redeploy; indexes build in the background |
| Functions | Payments and any callable API | Redeploy the previous commit's Functions |

## Security controls

| Control | Where | Notes |
| :--- | :--- | :--- |
| Secret scanning (PR/push) | `ci.yml` → `secrets` | gitleaks container pinned by digest; scans only the PR's commits |
| Secret scanning (history) | `security.yml` → `history` | Weekly full-history sweep, catches secrets added to old commits |
| Secret scanning (local) | `.pre-commit-config.yaml` | `pre-commit install` then gitleaks runs on staged changes |
| Push protection | GitHub repository settings | Blocks a credential before it reaches the remote |
| SAST | `codeql.yml` | `security-extended` queries for JavaScript/TypeScript |
| Dependency review | `ci.yml` → `dependency-review` | Advisory only: the dependency graph is disabled on this repository, so the action cannot run. Enable **Settings → Code security → Dependency graph** and drop `continue-on-error` to make it blocking |
| Vulnerability audit | `ci.yml` → `audit`, `security.yml` → `audit` | `npm audit --omit=dev --audit-level=high` for app and Functions |
| SBOM | `security.yml` → `sbom` | CycloneDX, kept 90 days as an artifact |
| Dependency updates | `.github/dependabot.yml` | Weekly npm (app + Functions) and GitHub Actions updates, grouped |
| Least privilege | every workflow | `permissions: contents: read` by default; write scopes only where required |
| Supply chain | every `uses:` | Pinned to a full commit SHA with the version in a comment |
| Rules tests | `ci.yml` → `rules` | Firestore emulator runs the rules suite on every PR |
| Post-deploy check | `deploy.yml` | HTTP 200 plus security headers on the live site |

Threshold policy: **high** and **critical** runtime advisories fail the build;
moderate advisories are reported but do not block. Development-only advisories
are reported in the weekly summary. When Dependabot cannot fix an advisory,
document the accepted risk in [`SECURITY.md`](../SECURITY.md) rather than
lowering the threshold.

## Repository settings as code

Branch protection cannot be stored in a file by GitHub itself, so it lives in a
small script:

```bash
GITHUB_TOKEN=<admin token> node scripts/ops/apply-branch-protection.mjs            # dry run
GITHUB_TOKEN=<admin token> node scripts/ops/apply-branch-protection.mjs --apply    # write
GITHUB_TOKEN=<admin token> node scripts/ops/apply-branch-protection.mjs --apply --require-pr
```

It requires a token with **Administration: write** (fine-grained) or the `repo`
scope (classic) — a token used for normal pushes will get a 403. The default
configuration requires a green run of every check above, a branch that is up to
date with `main`, linear history, conversation resolution, no force pushes and
no deletions. `--require-pr` additionally requires a pull request; on a
solo-maintained repository that means "always work on a branch" without needing
a second reviewer. `--enforce-admins` applies the rules to you as well.

The same run also attempts to enable secret scanning push protection, which is
free for public repositories. If the token or plan cannot enable it, enable it
under **Settings → Code security**.

`CODEOWNERS` marks the rules, Functions and pipeline files for review. Code-owner
review only becomes mandatory if branch protection asks for it; the script sets
`require_code_owner_reviews: false` by default because the repository has a
single maintainer.

## Secrets and variables inventory

GitHub Actions **secrets** (Settings → Secrets and variables → Actions):

| Name | Purpose | Where else it exists |
| :--- | :--- | :--- |
| `FIREBASE_SERVICE_ACCOUNT` | Deploy authentication (Hosting, rules, Functions) | Service-account key in Google Cloud, rotated per runbook |
| `VITE_FIREBASE_API_KEY` | Baked into the browser bundle | Firebase console → Project settings (public) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same | Public |
| `VITE_FIREBASE_PROJECT_ID` | Build config **and** deploy target project | Public |
| `VITE_FIREBASE_STORAGE_BUCKET` | Same | Public |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same | Public |
| `VITE_FIREBASE_APP_ID` | Same | Public |

GitHub Actions **variables**: `CRYPTO_PROVIDER` (`nowpayments` enables the
Functions deploy step).

Firebase Functions secrets (only when `USE_SECRET_MANAGER=true`):
`NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` — set with
`firebase functions:secrets:set`, never in the repository.

The `VITE_*` values are project identifiers that ship to every browser; they are
not authorization. Firestore rules and Authentication are. Keep any value that
actually grants access out of `VITE_*`.

Deploy identity: the service account should hold only what the pipeline needs —
Firebase Hosting Admin, Firebase Rules Admin, Cloud Functions Developer and
Service Account User on the Functions runtime identity. Do not use a
project-Owner key.

## Local parity

Run the same checks CI runs, before pushing:

```bash
cd umnotho
npm run verify        # lint + typecheck + unit tests + build
npm run security      # lint + production dependency audit
npm run test:rules    # Firestore emulator suite (needs Java 11+)
npm --prefix functions test
```

`npm run verify` exists so "it passed locally" and "CI is green" mean the same
thing. The only CI step with no local equivalent is the containerised gitleaks
run; install the `gitleaks` binary and run `gitleaks detect --config .gitleaks.toml`
if you need it.

## Cost and quotas

- GitHub Actions is free for public repositories. Expect roughly 6–10 minutes
  per push: the rules job (Java + emulator) is the slowest.
- Firebase Hosting on the Spark plan serves the SPA for free; preview channels
  are also available on Spark.
- Cloud Functions need Blaze. Set a **budget alert** in Google Cloud before
  enabling them: Functions, Cloud Run, Cloud Build and Artifact Registry all
  bill per use.

## Deliberate limitations

- Production deploys are skipped, not simulated, when credentials are absent.
- Preview channels are only created for branches in this repository; fork PRs
  build but cannot deploy (they receive no secrets).
- Branch protection is applied by script, not automatically, because it needs an
  admin token.
- The weekly full-history secret scan is the only check that sees older commits.
- Nothing here provisions Firebase projects or IAM; that stays manual.

## Troubleshooting pipelines

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Deploy did not run after a merge | CI failed, or CI did not run on that commit | Actions → CI for the commit; re-run, or use `workflow_dispatch` |
| Deploy green but site unchanged | Credentials missing (see the notice) | Set `FIREBASE_SERVICE_ACCOUNT` and `VITE_FIREBASE_PROJECT_ID` |
| `Secret scan` fails on a legitimate value | Pattern matches a fixture or sample | Prefer a targeted `[allowlist]` entry in `.gitleaks.toml` with a comment explaining why; never disable the job |
| `Dependency review (advisory)` fails | Expected while the dependency graph is disabled; the advisory means it could not run | Treat as a reminder to enable the graph, not as a blocked merge |
| `Firestore security rules` times out | Emulator startup or port conflict | Re-run; the suite is single-port and occasionally slow on cold runners |
| `npm ci` fails on EUSAGE | Lockfile out of sync with `package.json` | Run `npm install` locally and commit the lockfile |
