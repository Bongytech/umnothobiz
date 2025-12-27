# Security Policy 🛡️

## 🎯 Our Commitment
At **Unmotho**, security is not a feature—it is a core foundation. We implement a **Shift-Left DevSecOps** approach to ensure that our platform and our users' data remain protected against evolving threats.

---

## 🏹 Supported Versions

We actively provide security patches for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest (main branch) | ✅ Supported |
| < 1.0.0  | ❌ Not Supported |

---

## 🚨 Reporting a Vulnerability

**Please do NOT open a public GitHub Issue for security vulnerabilities.**

If you discover a security vulnerability, we would appreciate it if you could report it to us privately. Publicly disclosing a vulnerability before a fix is available puts all users at risk.

### How to Report
1. **Private Vulnerability Reporting:** The preferred method is using GitHub's [Private Vulnerability Reporting](https://github.com/unmothobiz/unmotho/security/advisories/new) feature.
2. **Email:** Alternatively, email our security team at [security@unmotho.com](mailto:security@unmotho.com).

### What to include in your report:
To help us triage and fix the issue quickly, please include:
- **Type of issue** (e.g., XSS, SQLi, Broken Auth).
- **Location** (e.g., specific Cloud Function, Firestore rule, or UI component).
- **Proof of Concept (PoC)** or steps to reproduce.
- **Impact** (What could an attacker do with this vulnerability?).

---

## ⏱️ Our Response Process

When we receive a report, the Unmotho Security Team follows this timeline:

1. **Acknowledgment:** Within **12–24 hours** of receipt.
2. **Triage:** We will verify the vulnerability within **3 business days**.
3. **Fix:** For critical issues, we aim for a resolution within **72 hours**.
4. **Disclosure:** Once the fix is deployed and verified, we will coordinate a public announcement and credit the researcher.

---

## 📜 Rules of Engagement (Bug Bounty Guidelines)

To encourage responsible disclosure, we ask that you:
- **Avoid Privacy Violations:** Do not attempt to access or modify data that does not belong to you.
- **No Disruption:** Do not perform DDoS attacks, spamming, or high-intensity automated scanning.
- **No Social Engineering:** Do not target Unmotho employees or users with phishing or physical attacks.
- **Good Faith:** Act in a way that avoids harm to the platform or its users.

---

## 🛠️ Security Architecture Brief
The Unmotho platform uses the following security controls:
- **SAST/SCA:** Automated code and dependency scanning via GitHub Actions.
- **Secrets Detection:** Gitleaks and TruffleHog monitoring for all commits.
- **Identity:** Firebase Auth with JWT validation.
- **Data:** Firestore Security Rules enforcing "Least Privilege."

---
*Thank you for being part of the Unmotho security community!*