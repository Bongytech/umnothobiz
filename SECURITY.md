# Security policy

Umnotho is a portfolio project, not a hardened production marketplace. This
document describes what the code actually enforces so contributors and users can
reason about risk honestly.

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
  - signed-in users may read profiles;
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

## Known limitations

These are deliberate gaps in a demo, not unnoticed bugs:

- **No rate limiting or spam controls.** A signed-in user can create many
  listings, questions, bids or messages within the schema limits.
- **Ratings are not tied to a verified completed transaction** in rules. The UI
  only offers rating after a completed bid, but a determined client could write a
  rating for any other user once. A production system needs a trusted backend or
  Cloud Function to validate the trade.
- **No email-verification gate.** Accounts are usable immediately after signup.
- **Paid plans are display-only.** No payment data is collected and no client can
  grant itself a plan.
- **No moderation or admin tooling.** Abusive content must be handled manually in
  the Firebase console.
- **No image/file storage.** The Storage integration is not enabled.
- **Rules tests require the emulator.** They run in CI with Java and confirm the
  access rules, but they do not test Firebase project IAM or billing controls.

## Secure development practices in this repo

- ESLint runs with TypeScript, React Hooks and security plugins; CI allows zero
  warnings.
- `npm run security` runs the linter and a production-dependency audit
  (`npm audit --omit=dev --audit-level=high`); `npm run security:all` also
  includes dev-tool advisories. The application's production dependency tree
  currently audits clean; the remaining advisories are in development tooling.
- `.env*` files are ignored except `.env.example`; service-account JSON is
  ignored.
- GitHub Actions uses npm with a committed lockfile and least-privilege
  permissions.
- Secret scanning can be enabled with GitHub's own secret scanning or a gitleaks
  pre-commit hook; the old ad-hoc workflow files were removed because they
  referenced a non-existent `functions/` directory.

## Hardening ideas for a real deployment

1. Move ratings, reputation, plan changes and payment webhooks to trusted Cloud
   Functions.
2. Add App Check to reduce scripted abuse.
3. Add rate limiting at the callable-function or API-gateway layer.
4. Add email verification and, for business accounts, KYB checks.
5. Add automated backup/export and an incident-response runbook.
6. Add dependency and container scanning (Dependabot is already configured).

Last reviewed: 2026-11-03.
