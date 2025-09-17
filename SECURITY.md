# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously at Asfalis Security Scanner. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@asfalis.com**

Include the following information in your report:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact and severity
- Any suggested fixes or mitigations
- Your contact information

### Response Timeline

- **Initial Response**: We will acknowledge receipt within 24 hours
- **Assessment**: We will assess the vulnerability within 5 business days  
- **Resolution**: Critical issues will be addressed within 7 days
- **Disclosure**: Public disclosure after fix is deployed (typically 30-90 days)

### Security Best Practices

When using Asfalis Security Scanner:

1. **Environment Variables**: Never commit sensitive environment variables
2. **Access Tokens**: Rotate GitHub tokens regularly
3. **Database Security**: Use strong MongoDB authentication
4. **HTTPS**: Always use HTTPS in production
5. **Updates**: Keep dependencies up to date

### Security Features

- JWT token authentication with expiration
- GitHub OAuth secure implementation  
- Webhook signature verification
- Input validation and sanitization
- Rate limiting and DDoS protection
- Security headers and CSRF protection

Thank you for helping keep Asfalis Security Scanner secure!
