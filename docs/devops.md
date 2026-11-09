# DevOps and DevSecOps

How this repository is built, tested, scanned and deployed, and what a
maintainer has to do by hand. If you only read one section, read
[Deployment flow](#deployment-flow) and
[Repository settings as code](#repository-settings-as-code).

## Environments

Staging and UAT are **environments, not repositories**. One repository deploys
to three isolated Firebase projects; the code, rules and payment logic exist
once.

| Environment | Firebase project | URL | How it is reached |
| :--- | :--- | :--- | :--- |
| Local | emulator suite | `http://localhost:5173` | `npm run emulators` + `npm run dev` |
| Preview | production project, channel `pr-<n>` | per-PR channel URL | Automatic on pull requests from this repository |
| Staging | `umnotho-staging` | <https://umnotho-staging.web.app> | Every green CI run on `main` |
| UAT | `umnotho-uat` | <https://umnotho-uat.web.app> | Pushing a `v*` release tag (or manual). Tagging is the sign-off |
| Production | `umnotho-f71ba` | <https://umnothobiz.web.app> | Green CI on `main`, and a successful UAT deployment of that commit when `REQUIRE_UAT_SIGNOFF=true` |

`umnotho-staging` and `umnotho-uat` are the project ids the workflows expect. If
a name is unavailable, pick another and set that project id in the environment's
`VITE_FIREBASE_PROJECT_ID` secret — nothing is hard-coded except the production
id, which the deploy workflows refuse to use outside production.

Staging and UAT build from `firebase.staging.json` and `firebase.uat.json`, which
add `X-Robots-Tag: noindex` and point the CSP at their own project domain. They
use the project's default Hosting site, so no `firebase hosting:sites:create`
step is needed.

> Preview channels still deploy to the **production** project (they share its
> Firestore). Until previews move to the staging project, treat a preview build
> as touching production data.

## Pipeline overview

```
pull request ──► CI (lint, typecheck, unit, rules, functions, audit, secrets, dependency review)
             └─► CodeQL (SAST)
             └─► Preview (Firebase Hosting preview channel)

main push ─────► CI ──(green)──► Deploy staging     (always)
                            └──► Deploy production   (skips until UAT has signed off,
                                                      when REQUIRE_UAT_SIGNOFF=true)

tag v* ────────► Deploy UAT (only commits already on main)

weekly ────────► Security scan (full-history secrets, dependency audit, SBOM)
             └─► CodeQL
```

| Workflow | File | Trigger | Gate for production |
| :--- | :--- | :--- | :--- |
| CI | `.github/workflows/ci.yml` | push to `main`, all PRs, manual | **Yes** – deploys wait for a green CI run |
| Deploy staging | `.github/workflows/deploy-staging.yml` | `workflow_run` of CI on `main`, manual | – |
| Deploy UAT | `.github/workflows/deploy-uat.yml` | push tag `v*`, manual | **Yes**, when `REQUIRE_UAT_SIGNOFF=true` |
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

Three deploy workflows share one shape: checkout the exact commit, build with the
environment's `VITE_FIREBASE_*`, deploy rules and indexes before Hosting, deploy
Functions only when that environment's `CRYPTO_PROVIDER=nowpayments`, then smoke
test. They differ in trigger, project and config file.

**Staging** (`deploy-staging.yml`) runs on every green CI run for `main`, so the
current `main` is always available to click through. It refuses to run against
the production project id.

**UAT** (`deploy-uat.yml`) runs when a `v*` tag is pushed, or manually for a tag
or commit. It verifies the commit is already on `main` (tagging a side branch is
not a release), then deploys to `umnotho-uat`. Creating the tag is the sign-off:
there is no second reviewer to approve a deployment in a single-maintainer
repository.

**Production** (`deploy.yml`) is triggered by CI finishing, not by the push
itself, so a red test, audit or secret scan can never reach production. The job:

1. Checks out the exact commit CI tested (`workflow_run.head_sha`).
2. Builds with the production `VITE_FIREBASE_*` configuration.
3. Exits cleanly, with a notice, when `FIREBASE_SERVICE_ACCOUNT` or
   `VITE_FIREBASE_PROJECT_ID` is missing. A fresh clone therefore does not fail
   every push to `main`.
4. When `vars.REQUIRE_UAT_SIGNOFF=true`, checks the GitHub deployments API for a
   successful `uat` deployment of this commit and skips (with a notice) instead of
   shipping if there is none. Manual runs bypass this, which is the hotfix path.
5. Deploys `firestore.rules` and `firestore.indexes.json` before the app, so
   rules can never lag behind the code that depends on them.
6. Deploys Cloud Functions only when the repository variable
   `CRYPTO_PROVIDER=nowpayments` is set.
7. Deploys the `live` Hosting channel.
8. Smoke tests the site: retries until HTTP 200, then asserts
   `Strict-Transport-Security`, `X-Content-Type-Options` and `X-Frame-Options`
   are still sent. Staging and UAT also assert `X-Robots-Tag: noindex` so a
   preview environment never gets indexed.

Manual deploys are allowed with `workflow_dispatch` (Actions → the workflow →
Run workflow) for cases where you need to re-ship without a new commit. That path
still builds and smoke tests, but it does not re-run CI — prefer pushing a commit.

### Promotion

```
feature branch ──PR──► main ──► staging (automatic)
                         │
                         └── tag v1.2.3 ──► UAT (automatic on tag)
                                              │
                                              └── production (next CI run, or re-run Deploy)
                                                  when REQUIRE_UAT_SIGNOFF=true
```

Hotfix: fix on a branch, merge to `main`, watch staging, then either tag and let
production follow, or `workflow_dispatch` the production deploy to bypass the UAT
gate when the change is trivial and already verified on staging.

### What each deploy can and cannot break

| Step | Blast radius | Recovery |
| :--- | :--- | :--- |
| Hosting | The served frontend **in that environment only** | Firebase Hosting release history → roll back |
| Firestore rules | Every read/write path in that project | Revert the commit and redeploy rules (seconds) |
| Indexes | Query performance / `failed-precondition` in that project | Revert and redeploy; indexes build in the background |
| Functions | Payments and callable APIs in that project | Redeploy the previous commit's Functions |

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
GITHUB_TOKEN=<admin token> node scripts/ops/apply-branch-protection.mjs                # dry run
GITHUB_TOKEN=<admin token> node scripts/ops/apply-branch-protection.mjs --apply        # write
GITHUB_TOKEN=<admin token> node scripts/ops/apply-branch-protection.mjs --checks-only --apply
```

It requires a token with **Administration: write** (fine-grained) or the `repo`
scope (classic) — a token used for normal pushes will get a 403.

The script **never downgrades an existing rule**. It reads the current protection
first and keeps the stricter value for approvals, code-owner review, admin
enforcement and linear history, so re-running it cannot silently remove a
requirement. `--require-pr` and `--enforce-admins` only ever turn a rule on;
`--linear-history` is opt-in because it changes how pull requests merge.

`--checks-only` is the surgical option: it updates the required status checks and
nothing else. That is how this repository was adopted, because `main` already
required a pull request, one approval and code-owner review with admins enforced.

Current state of `main` (applied and verified with the checks-only path):

- required checks: `Lint, typecheck, test, build`, `Firestore security rules`,
  `Cloud Functions`, `Dependency vulnerability audit`, `Secret scan`,
  `Analyze JavaScript/TypeScript`
- up-to-date branch required, one approving review, code-owner review,
  conversation resolution, no force pushes, no deletions, rules apply to admins
- secret scanning and push protection enabled; Dependabot security updates
  enabled

`CODEOWNERS` marks the rules, Functions and pipeline files for review; because
`main` requires code-owner review, those changes need the owner's approval.

## Secrets and variables inventory

Deployments use **environment-scoped** secrets and variables (Settings →
Environments → `staging` / `uat` / `production` → Secrets and variables). The
secret *names* are identical in every environment; the values point at that
environment's Firebase project. That is why the deploy workflows differ only in
`environment:` and their config file — nothing is duplicated or prefixed.

| Name | Scope | Purpose |
| :--- | :--- | :--- |
| `FIREBASE_SERVICE_ACCOUNT` | per environment | Deploy authentication (Hosting, rules, Functions) |
| `VITE_FIREBASE_API_KEY` | per environment | Baked into the browser bundle (public identifier) |
| `VITE_FIREBASE_AUTH_DOMAIN` | per environment | Public |
| `VITE_FIREBASE_PROJECT_ID` | per environment | Build config **and** deploy target project |
| `VITE_FIREBASE_STORAGE_BUCKET` | per environment | Public |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | per environment | Public |
| `VITE_FIREBASE_APP_ID` | per environment | Public |
| `CRYPTO_PROVIDER` *(variable)* | per environment | `nowpayments` enables the Functions deploy step in that environment |
| `REQUIRE_UAT_SIGNOFF` *(variable)* | repository | `true` makes production wait for a successful UAT deployment of the same commit |

If an environment has no secrets, its deploy workflow exits with a notice rather
than failing, so staging and UAT can be added before the Firebase projects exist.

Firebase Functions secrets (only when `USE_SECRET_MANAGER=true`):
`NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` — set per project with
`firebase functions:secrets:set`, never in the repository. Use test/sandbox
credentials in staging and UAT, never production keys.

The `VITE_*` values are project identifiers that ship to every browser; they are
not authorization. Firestore rules and Authentication are. Keep any value that
actually grants access out of `VITE_*`.

Deploy identity: the service account should hold only what the pipeline needs —
Firebase Hosting Admin, Firebase Rules Admin, Cloud Functions Developer and
Service Account User on the Functions runtime identity. Do not use a
project-Owner key, and do not reuse the production service account in staging or
UAT (the workflows refuse to deploy if the project id is the production one, but
IAM separation is the real control).

### Provisioning staging and UAT (one-time, needs Firebase console access)

The workflows are ready, but the Firebase projects have to be created once by the
owner. `firebase projects:create` needs an authenticated `gcloud`/`firebase` CLI;
it cannot be done from GitHub Actions with the existing deploy credentials.

```bash
# 1. Create the projects (ids must match, or update the environment secrets).
firebase projects:create umnotho-staging --display-name "Umnotho staging"
firebase projects:create umnotho-uat     --display-name "Umnotho UAT"

# 2. Add a Web app to each and copy its config into the GitHub environment.

# 3. Create a least-privilege service account per project and download a key.
gcloud iam service-accounts create deploy --project umnotho-staging
gcloud projects add-iam-policy-binding umnotho-staging \
  --member "serviceAccount:deploy@umnotho-staging.iam.gserviceaccount.com" \
  --role roles/firebasehosting.admin
gcloud projects add-iam-policy-binding umnotho-staging \
  --member "serviceAccount:deploy@umnotho-staging.iam.gserviceaccount.com" \
  --role roles/firebaserules.admin
gcloud iam service-accounts keys create staging-key.json \
  --iam-account deploy@umnotho-staging.iam.gserviceaccount.com

# 4. Enable the APIs the deploy needs (and Blaze if Functions are deployed).
firebase projects:list                       # confirm the ids
```

Then, in GitHub → Settings → Environments, create `staging` and `uat`, add the
seven secrets to each, and set that environment's `CRYPTO_PROVIDER` variable if
Functions should run there. The environments already exist; they are just empty.

Firestore in a new project starts with no data and default rules — the first
staging deploy replaces the rules, and any seed data must be created deliberately.

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
- Staging and UAT deploys are skipped until their GitHub Environments have
  secrets; the Firebase projects themselves are created by hand (see
  [Provisioning](#provisioning-staging-and-uat-one-time-needs-firebase-console-access)).
- Preview channels still point at the production project and therefore its
  Firestore. Moving previews to the staging project is the next isolation step.
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
| Deploy green but site unchanged | Credentials missing (see the notice) | Set `FIREBASE_SERVICE_ACCOUNT` and `VITE_FIREBASE_PROJECT_ID` — on the environment, not the repository |
| `Deploy staging` says "Refusing to deploy staging to the production project" | Staging environment has the production project id | Fix `VITE_FIREBASE_PROJECT_ID` in the `staging` environment |
| `Deploy UAT` fails "is not on main" | Tag or commit is not an ancestor of `main` | Tag a commit that has been merged and passed CI |
| Production deploy skipped after a tag | `REQUIRE_UAT_SIGNOFF=true` and no successful UAT deployment for that commit | Let `Deploy UAT` finish, then re-run `Deploy`, or dispatch it manually for a hotfix |
| `Secret scan` fails on a legitimate value | Pattern matches a fixture or sample | Prefer a targeted `[allowlist]` entry in `.gitleaks.toml` with a comment explaining why; never disable the job |
| `Dependency review (advisory)` fails | Expected while the dependency graph is disabled; the advisory means it could not run | Treat as a reminder to enable the graph, not as a blocked merge |
| `Firestore security rules` times out | Emulator startup or port conflict | Re-run; the suite is single-port and occasionally slow on cold runners |
| `npm ci` fails on EUSAGE | Lockfile out of sync with `package.json` | Run `npm install` locally and commit the lockfile |
