# 🔐 UMNOTHO - Peer-to-Peer Barter Platform
## 🌐 Live Demo

Try out the live application: [**UMNOTHO Live Demo**](https://umnothobiz.web.app/)
## ✨ Features

### 🛡️ **Security Features**
- **Authentication:** Secure user authentication with Firebase
- **Data Protection:** Encrypted data storage and secure API communication
- **Audit Logging:** Activity tracking for user actions
- **Authorization:** User role and permission management

### 📊 **Platform Features**
- **Barter Listings:** Create and browse goods/services for exchange
- **Bid Management:** Place, negotiate, and manage trade offers
- **User Messaging:** In-app communication between traders
- **Reputation System:** Community-based trust scoring
- **Location-Based Matching:** Find trades based on proximity

### 🔌 **Technical Features**
- **Real-time Updates:** Live data synchronization via Firestore listeners
- **Responsive Design:** Mobile-friendly interface for all devices
- **Offline Support:** Basic offline functionality with local caching
- **Type Safety:** Full TypeScript implementation across the stack

---

## 🚀 Quick Start

### Prerequisites
- **Node.js:** 18.x or higher
- **npm:** 9.x or higher
- **Git:** Latest version
- **Firebase Account:** For backend services
- **Browser:** Modern Evergreen Browser (Chrome 90+, Firefox 88+, Safari 14+)

### Installation

```bash
# Clone the repository
git clone https://github.com/Bongytech/umnothobiz.git
cd umnotho

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Firebase configuration to .env

# Start development server
npm run dev
```

### Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start development server |
| `npm run build` | Build the application for production |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run test suite |
| `npm run lint` | Run code quality checks |

---

## 🏗️ Architecture

### Tech Stack
- **Frontend:** React 18 + TypeScript
- **State Management:** React Context API + Custom Hooks
- **Routing:** React Router v6
- **Styling:** CSS Modules / Styled Components
- **Backend:** Firebase (Firestore, Authentication, Storage)
- **Real-time Communication:** Firestore listeners
- **API Communication:** Firebase SDK + Custom API calls

### Key Integrations
- **Firebase Firestore:** Real-time database and data storage
- **Firebase Authentication:** User management and security
- **Firebase Storage:** File and image uploads
- **Firebase Hosting:** Application deployment

---

## 🔧 Development

For detailed development guidelines, see our [Developer Documentation](./DEVELOPMENT.md).

### Development Workflow
1. **Fork** the repository.
2. **Clone** your fork.
3. **Branch** from `main` (`git checkout -b feature/amazing-feature`).
4. **Code** with accompanying tests.
5. **Test** your changes locally.
6. **Push** to your fork.
7. **PR** to the upstream repository.

### Code Standards
- TypeScript for all new code
- ESLint for code quality
- Prettier for consistent formatting
- Meaningful commit messages
- Regular dependency updates

---

## 🔒 Security

Security is important. For comprehensive security information, see our [Security Documentation](./SECURITY.md).

### Current Security Features
- ✅ Firebase Authentication with email verification
- ✅ Firestore Security Rules for data protection
- ✅ Input validation and sanitization
- ✅ Secure API key management
- ✅ Regular dependency updates

### Reporting Security Issues
Found a security vulnerability? Please **do not** open a public issue. Report it responsibly via email.

---

## 🧪 Testing

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run linting checks
npm run lint
```

- **Unit Tests:** React Testing Library
- **Integration Tests:** Manual testing with Firebase Emulator
- **Security Checks:** Basic vulnerability scanning

---

## 📚 Documentation

### Project Documentation
- [Setup Guide](./docs/setup.md) - Getting started instructions
- [Firebase Configuration](./docs/firebase.md) - Backend setup
- [Data Models](./docs/models.md) - Database structure
- [API Reference](./docs/api.md) - Available endpoints

### Quick Links
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [License](./LICENSE)

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) to get started.

- 🐛 **Report bugs** - Open an issue
- ✨ **Suggest features** - Start a discussion
- 📝 **Improve docs** - Submit a PR
- 🔧 **Fix issues** - Check open issues

---

## 📄 License & Usage Terms

**UMNOTHO** is released under a **source-available, non-commercial license**. This project is primarily a **portfolio piece and community collaboration experiment**, not a production-ready commercial product.

### ✅ **What you CAN do:**
- View, study, and learn from the source code
- Use the software for personal or educational purposes
- Contribute improvements via pull requests
- Fork and modify for non-commercial projects
- Share with others for learning purposes

### ⚠️ **What you CANNOT do without explicit permission:**
- Use this software for commercial purposes
- Resell, monetize, or charge for access to this software
- Offer this software as a paid service (SaaS)
- Use this software in production environments for business revenue
- Incorporate into commercial products without written consent

### 🎯 **Project Intent:**
This is a **portfolio demonstration project** showcasing full-stack development skills with Firebase and React. It's not intended for commercial deployment by third parties. For commercial licensing inquiries, please contact the author directly.

**Legal Note:** For the complete legal terms, please read the full license file. This summary is for convenience only and does not replace the actual license terms.

---

## 🙏 Acknowledgments

- [React](https://reactjs.org/) for the UI library
- [TypeScript](https://www.typescriptlang.org/) for type safety
- [Firebase](https://firebase.google.com/) for backend services
- [Vite](https://vitejs.dev/) for build tooling
- All contributors and supporters!

<div align="center">

Made with ❤️ by the **UMNOTHO Team**

[📖 Developer Guide](./DEVELOPMENT.md) • [🔒 Security Guide](./SECURITY.md) • [🐛 Report Bug](mailto:bongytech@gmail.com?subject=Bug%20Report%20-%20UMNOTHO%20Platform) • [✨ Request Feature](mailto:bongytech@gmail.com?subject=Feature%20Request%20-%20UMNOTHO%20Platform)

</div>
