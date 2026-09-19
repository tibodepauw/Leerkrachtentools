# Security Policy

## Supported versions

Security fixes are developed on `main`. As of 19 September 2026, the latest
published security baseline is **v5.21.0-rc.1**, a pre-release for staging and VM
acceptance. **v5.20.1** remains the latest stable-labelled release, but does not
contain all subsequent security and privacy fixes. Older tags are historical
snapshots; fixes on `main` do not update an existing tag.

See the [release notes](docs/releases/v5.21.0-rc.1.md) and
[documentation index](docs/README.md) for the tested scope and remaining
production checks. A pre-release or passing CI is not production certification.

## Reporting a vulnerability

If you discover a security issue, please report it responsibly. Do **not** open a public GitHub issue for vulnerabilities.

**Preferred channel:**

[GitHub Security Advisories](https://github.com/tibodepauw/Leerkrachtentools/security/advisories/new) (private report)

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
