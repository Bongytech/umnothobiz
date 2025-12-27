```markdown
# 👨‍💻 Developer Documentation

## 🚀 Getting Started

### Prerequisites Checklist
- [ ] **Node.js 18+** (`node --version`)
- [ ] **npm 9+** (`npm --version`)
- [ ] **Git** (`git --version`)
- [ ] **IDE** (VSCode recommended)
- [ ] **Docker** (Optional, for containerized development)

### First-Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/umnotho.git
cd umnotho

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local

# 4. Start development
npm run dev
```

### Environment Variables
Create `.env.local` in the root:

```env
# Application
VITE_APP_NAME="UMNOTHO"
VITE_APP_VERSION=1.0.0
VITE_API_URL=http://localhost:3000/api

# Authentication
VITE_AUTH_DOMAIN=auth.your-domain.com
VITE_AUTH_CLIENT_ID=your-client-id

# Security (NEVER commit real keys to Git)
VITE_ENCRYPTION_KEY=your-dev-key-here
```

---

## 🏗️ Project Structure

```text
umnotho/
├── 📁 src/                  # Source code
│   ├── 📁 components/       # UI Components (Atomic Design)
│   ├── 📁 hooks/            # Custom React hooks
│   ├── 📁 utils/            # Pure utility functions
│   ├── 📁 services/         # API & External services
│   ├── 📁 types/            # TypeScript interfaces/types
│   ├── 📁 store/            # State management (Context/Zustand)
│   └── 📁 assets/           # Images, fonts, global CSS
├── 📁 public/               # Static public assets
├── 📁 docs/                 # Detailed documentation
├── 📁 scripts/              # Build and CI/CD scripts
├── 📄 vite.config.ts        # Vite configuration
└── 📄 tsconfig.json         # TS configuration
```

---

## 🧪 Development Workflow

### Branch Strategy
- `main`: Production-ready code only.
- `develop`: Main integration branch.
- `feature/*`: New features or improvements.
- `hotfix/*`: Urgent production fixes.

### Commit Message Convention
We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` A new feature.
- `fix:` A bug fix.
- `docs:` Documentation only changes.
- `style:` Formatting, missing semi colons, etc.
- `refactor:` Code change that neither fixes a bug nor adds a feature.

---

## 🔧 Tooling Setup

### Recommended VS Code Extensions
- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`)
- Vitest (`vitest.explorer`)

### Development Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Starts Vite dev server with HMR |
| `npm run build` | Compiles code for production |
| `npm run lint` | Runs ESLint and Prettier checks |
| `npm run test` | Runs the Vitest test suite |
| `npm run type-check` | Runs TypeScript compiler check |

---

## 📝 Code Standards

### TypeScript Guidelines
- Always use interfaces for objects; use types for unions/aliases.
- Avoid `any` at all costs. Use `unknown` if the type is truly dynamic.
- Export types from a central `types/` directory when shared.

### React Component Patterns
```typescript
// ✅ Functional Components with Props interfaces
interface UserCardProps {
  name: string;
  role: 'admin' | 'user';
}

export const UserCard = ({ name, role }: UserCardProps) => {
  return <div className="p-4 border">{name} ({role})</div>;
};
```

---

## 🧪 Testing Guide

We use **Vitest** and **React Testing Library**.

```bash
# Run tests in watch mode
npm run test

# Check coverage
npm run test:coverage
```

**Requirements:**
1. All new components must have a `.test.tsx` file.
2. Logic in `utils/` must have 100% unit test coverage.
3. Complex user flows must have an integration test.

---

## 🚢 Deployment

1. Ensure `npm run build` passes locally.
2. Merges to `main` trigger the GitHub Action for production deployment.
3. Verify the **Security Audit** (`npm run security:report`) passes before any production release.

---

## 🤝 Team Practices

- **Code Reviews**: Every PR requires at least 2 approvals.
- **Standups**: Daily at 09:30 AM via Slack/Teams.
- **Blockers**: Post in `#dev-help` if you are stuck for more than 1 hour.

<div align="center">

Happy Coding! 🚀

[🔙 Back to Main README](./README.md) • [🔒 Security Guide](./SECURITY.md)

</div>
```

---

### 4. Supporting Files

#### CHANGELOG.md
```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2023-10-27
### Added
- Initial project structure with Vite + React + TypeScript.
- Integrated Tailwind CSS for styling.
- Core Documentation suite (README, SECURITY, DEVELOPER).
- Initial CI/CD pipeline configuration.

### Security
- Implemented ESLint security plugins.
- Added automated dependency vulnerability scanning.
```

#### CONTRIBUTING.md
```markdown
# Contributing to UMNOTHO

We love your input! We want to make contributing to UMNOTHO as easy and transparent as possible.

## Pull Request Process

1. **Fork** the repository and create your branch from `develop`.
2. **Install** dependencies with `npm install`.
3. **Draft PR**: If your work is in progress, open a Draft PR.
4. **Testing**: Ensure all tests pass (`npm run test`) and no linting errors exist.
5. **Review**: Once submitted, tag the relevant leads for review.

## Code of Conduct
By participating, you are expected to uphold our Code of Conduct.
```

#### CODE_OF_CONDUCT.md
```markdown
# Code of Conduct

## Our Pledge
We pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

## Standards
- Use welcoming and inclusive language.
- Be respectful of differing viewpoints and experiences.
- Gracefully accept constructive criticism.
- Focus on what is best for the community.

## Enforcement
Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to the project team at `admin@your-org.com`.
```