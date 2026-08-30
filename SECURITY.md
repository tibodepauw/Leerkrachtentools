# Security Policy

## Supported versions

Security fixes apply to the latest release on the `main` branch.

| Version | Supported |
| ------- | --------- |
| 5.9.x   | Yes       |
| 5.8.x   | No        |

## Reporting a vulnerability

If you discover a security issue, please report it responsibly. Do **not** open a public GitHub issue for vulnerabilities.

**Preferred channels:**

1. [GitHub Security Advisories](https://github.com/tibodepauw/Leerkrachtentools/security/advisories/new) (private report)
2. Email: [r1058655@student.thomasmore.be](mailto:r1058655@student.thomasmore.be)

Include a clear description, steps to reproduce, and impact if known. We aim to acknowledge reports within a few working days.

## Credentials and secrets

Private credentials and API keys must **never** be committed to this repository.

- Store secrets only in `.env.local` on your own machine or in your deployment environment
- Use `.env.example` as a template with empty values
- `.env.local` and other local env files are gitignored by design

If you accidentally push a secret, rotate it immediately and contact us so we can help assess exposure.

## Scope

Reports welcome for authentication, session handling, data exposure, injection, and dependency vulnerabilities in this application and its maintenance scripts.

General feature requests and didactic feedback belong in [CONTRIBUTING.md](./CONTRIBUTING.md) or the in-app feedback form, not in security reports.
