# Privacy & Data Protection

OpusHeart stores personal data for community members — including data that, in
many jurisdictions, is "special category" (e.g. religious affiliation is implied
by membership; pastoral care notes may touch health). If you self-host OpusHeart
you are the **data controller** for your community's data. This document
describes what the software does so you can meet your obligations.

## What is encrypted at rest

Field-level **AES-256-GCM** encryption (authenticated) is applied to:

| Data | Where |
|------|-------|
| Member name, email, phone | `User` |
| Member care notes (content) | `MemberCareNote` |
| Household address | `Household` |
| Donation notes | `Donation` |
| Member custom fields (values) | `Member.customFields` |

The key comes from the `ENCRYPTION_KEY` environment variable (32 bytes / 64 hex
chars). **Keep it safe and back it up** — losing it makes encrypted data
unrecoverable; leaking it defeats the encryption.

## What is intentionally public

Some data is public **by design** — treat it accordingly and make sure members
understand it before they submit:

- **Prayer requests** with `congregation` or `mesh` visibility appear on the
  public prayer wall. `mesh` requests are federated to other OpusHeart instances
  worldwide so anyone can pray over them — this is the point of the feature.
  Only `pastor_only` requests stay private to staff.
- **Sermons, pages, and public events** are website content.
- **The member directory** shows members who opt in (`showInDirectory`).
- **Resource hub submissions** become a public community directory.

## Consent

- **Care tracking** is opt-in per member (`privacySettings.allowCareTracking`).
  The API refuses to create a care note for a member who has not consented
  (`CARE_CONSENT_REQUIRED`).
- **Prayer visibility** is chosen by the submitter per request.
- **Member directory / email / phone visibility** is controlled per field by the
  member via `PUT /api/auth/me`.

## Access auditing

Access to sensitive data and security-relevant actions are written to an
append-only `AuditLog` (actor email is stored only as a SHA-256 hash). Audited
events include: login, registration, role assignment, care-note access, data
export, and account deletion. Audit entries have a default 2-year TTL.

## Data subject rights (GDPR / CCPA)

- **Export** — `GET /api/privacy/export` returns the requesting member's data
  across all collections (account, member, household, care notes, donations,
  prayers, groups, bookings, messages, event RSVPs).
- **Erasure** — `DELETE /api/privacy/account` deletes the member's private data
  and account. Note the deliberate exceptions:
  - **Donations are anonymized, not deleted** — the donor link is severed but the
    financial record is retained to satisfy tax/charitable-giving record-keeping
    law. Adjust to your jurisdiction's retention period.
  - **Public/federated prayer requests are anonymized, not deleted** — the
    submitter link is removed and the request marked anonymous. Copies already
    federated to other instances cannot be recalled.

## Retention

Only audit logs (2 years) and password-reset tokens (short TTL) auto-expire today.
There is no automatic purge of inactive members, old messages, or resolved care
notes — define and apply a retention schedule appropriate to your community and
jurisdiction.

## Multi-factor authentication

TOTP-based MFA (RFC 6238) is available and works with any authenticator app
(Google Authenticator, Authy, 1Password, etc.). Enroll via
`POST /api/auth/mfa/enroll` (returns an `otpauth://` URL to scan), confirm with
`POST /api/auth/mfa/confirm`, and disable with `POST /api/auth/mfa/disable`
(requires a valid code). The TOTP secret is encrypted at rest. Recommended for
admin and pastor accounts.

## Known limitations / roadmap

- **Crypto-shredding** (per-instance keys so erasure can destroy a key and render
  data irrecoverable) is a design goal, not yet implemented — erasure currently
  removes/anonymizes records directly.
- **Outbound federation fan-out** is not implemented; inbound peer messages are
  signature-verified. Keep `FEATURE_CONNECT` off unless testing.

If you operate in the EU/UK, treat church membership and care/health notes as
special-category data and ensure you have a lawful basis and explicit consent
for processing.
