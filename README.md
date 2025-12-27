# 🛡️ Unmotho DevSecOps Platform

<div align="center">

![Security](https://img.shields.io/badge/Security-A%2B-brightgreen?style=for-the-badge&logo=shield)
![DevSecOps](https://img.shields.io/badge/DevSecOps-Active-success?style=for-the-badge&logo=githubactions)
![Firebase](https://img.shields.io/badge/Firebase-Suite-orange?style=for-the-badge&logo=firebase)

**The Unmotho Platform implements a "Zero-Trust" architecture with an automated "Shift-Left" security pipeline.**

[🏗️ Architecture](#️-architecture-overview) • [📊 Security Dashboard](#-security-health-dashboard) • [⚙️ Setup](#-developer-quick-start) • [🚨 Incident Response](#-incident-response--support)

</div>

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    subgraph "💻 LOCAL DEVELOPMENT"
        IDE[VS Code] --> PreC[Husky Pre-commit Hooks]
        PreC -->|Lint & Audit| Git[Git Push]
    end

    subgraph "🚀 GITHUB ACTIONS (CI/CD)"
        Git --> SAST[SAST: ESLint/Sonar]
        SAST --> SCA[SCA: Snyk/npm-audit]
        SCA --> SEC[Secrets: TruffleHog]
        SEC --> Build[Vite Secure Build]
        Build --> Deploy[Firebase Deploy]
    end

    subgraph "🔥 FIREBASE RUNTIME"
        Deploy --> Host[Firebase Hosting]
        Host --> Func[Firebase Functions]
        Func --> DB[(Cloud Firestore)]
        DB --> Rules{Security Rules}
    end

    style Host fill:#f6820d,stroke:#fff,color:#fff
    style DB fill:#ffca28,stroke:#fff,color:#000
    style SAST fill:#2196f3,stroke:#fff,color:#fff
    style SEC fill:#f44336,stroke:#fff,color:#fff
