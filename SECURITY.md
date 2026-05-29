# Security Policy

We take the security of OpusHeart seriously — it holds congregation PII, care
notes, and giving records for the communities that run it.

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately to **security@137andco.com** (or hello@137andco.com if that
bounces). Include:

- a description of the issue and its impact,
- steps to reproduce (a proof-of-concept if possible),
- affected version / commit, and
- any suggested remediation.

We aim to acknowledge reports within **3 business days** and to provide a
remediation timeline after triage. Please give us a reasonable window to fix the
issue before any public disclosure; we're happy to credit reporters who want it.

## Supported Versions

OpusHeart is pre-1.0. Security fixes land on the latest release on the default
branch. Pin a released tag/digest for production and update promptly.

## Scope & hardening notes

- Passwords are hashed with **Argon2id**; PII is encrypted at rest with
  **AES-256-GCM**; lookup indexes use a keyed HMAC (not a plain hash).
- The server **refuses to boot in production** with placeholder/dev secrets.
- Run behind a TLS-terminating reverse proxy and set `TRUST_PROXY` to the
  number of proxy hops so rate limiting and audit logs see real client IPs.
- Rotate `JWT_SECRET` and `ENCRYPTION_KEY` if you suspect exposure (note:
  rotating `ENCRYPTION_KEY` requires re-encrypting existing data).
- Federation (Connect) is **experimental and off by default**.

If you operate a deployment, subscribe to releases so you see security updates.
