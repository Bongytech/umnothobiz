# Contributing to UMNOTHO

Thank you for your interest in contributing to UMNOTHO! This project is a portfolio piece and community collaboration experiment, and we welcome contributions that help improve the codebase, documentation, or overall user experience.

## Code of Conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md) to help us maintain a welcoming and respectful community.

## How Can I Contribute?

### 🐛 Reporting Bugs
- **Check existing issues** to avoid duplicates
- **Use the bug report template** when creating a new issue
- **Include detailed steps** to reproduce the issue
- **Provide environment details** (browser, OS, Node version)
- **Add screenshots or videos** if applicable

### 💡 Suggesting Features
- **Check existing feature requests** first
- **Explain the problem** the feature would solve
- **Describe your proposed solution**
- **Consider implementation complexity**
- **Discuss potential alternatives**

### 🔧 Code Contributions
- **Fork the repository**
- **Create a feature branch** from `main`
- **Write clear, focused commits**
- **Add tests** for new functionality
- **Update documentation** as needed
- **Submit a pull request**

## Development Setup

### Prerequisites
- Node.js 20.19+
- npm 10+
- Git
- Firebase account (for testing)

### Local Setup
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR-USERNAME/umnothobiz.git
   cd umnothobiz/umnotho
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Firebase:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Firebase web app values and enable Email/Password and Google
   sign-in in the Firebase console.
4. Run the checks:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```

## Pull Request Process

1. Branch from `main` (`git checkout -b fix/short-description`).
2. Keep the change focused. Update `firestore.rules` and `tests/rules/` if you
   change an authorization path.
3. Make sure `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`
   pass.
4. Open a pull request describing the problem, the change, and how you verified
   it. Screenshots are welcome for UI changes.
5. A maintainer will review. Please do not merge your own PR without review.

## Security

Do not open a public issue for a vulnerability. Follow
[SECURITY.md](./SECURITY.md) instead.

## Questions

Open a discussion or email [bongytech@gmail.com](mailto:bongytech@gmail.com).