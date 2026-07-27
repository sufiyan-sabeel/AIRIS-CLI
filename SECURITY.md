# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| latest | ✅ |
| < latest | ❌ |

## Reporting a Vulnerability

AIRIS-CLI takes security seriously. If you discover a security vulnerability, please **do not** open a public issue.

### How to Report

1. **Privately report via GitHub**: Go to [Security Advisories](https://github.com/sufiyan-sabeel/AIRIS-CLI/security/advisories) and click "Report a vulnerability"
2. **Email**: Contact the maintainers directly through GitHub

### What to Include

- Type of issue (e.g., command injection, XSS, prototype pollution)
- Full paths of source files related to the issue
- Step-by-step reproduction instructions
- Proof of concept or exploit code (if applicable)
- Impact assessment

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Fix timeline**: Depends on severity, typically 7-14 days for critical/high

## Security Practices

- All dependencies are pinned to exact versions
- npm lifecycle scripts are audited and allowlisted
- CI runs with `--ignore-scripts` for installs
- TypeScript strict mode enabled
- No inline dynamic imports for production code
- Regular npm audit runs on schedule

## Dependencies

This project uses automated dependency updates via Dependabot. Security patches are prioritized.

## Disclosure Policy

When a vulnerability is reported:
1. We acknowledge receipt within 48 hours
2. We validate and assess the issue
3. We develop and test a fix
4. We release a patched version
5. We publicly disclose after the fix is available

We follow coordinated disclosure to protect users.
