# 🔒 Security Policy

## Supported Versions
Currently security updates are applied to:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | ✅ Yes             |
| < 1.0   | ❌ No              |

## Reporting a Vulnerability

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead, please email: bongy.tech@gmail.com

### What to include:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

### Response Time:
- **Initial response**: Within 48 hours
- **Patch timeline**: 7-14 days for critical issues
- **Public disclosure**: After fix is deployed

## Security Practices

### Dependency Management
- All dependencies are scanned weekly with Snyk & OWASP Dependency-Check
- Critical updates are applied within 24 hours
- All new dependencies require security review

### Secrets Management
- No secrets are committed to version control
- Automated scanning on every commit
- Regular rotation of credentials

### Infrastructure Security
- Firebase security rules reviewed monthly
- Principle of least privilege applied
- Regular security audits

## Compliance
- GDPR compliant data handling
- Firebase security rules enforce data privacy
- Regular penetration testing

## Contact
- **Security Team**: bongy.tech@gmail.com
- **Emergency**: +27-XXX-XXX-XXXX (on-call rotation)
