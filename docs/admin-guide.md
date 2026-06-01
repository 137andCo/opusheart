# Admin Guide

## Feature Toggles

Features can be enabled/disabled via environment variables or the admin dashboard. Key toggles:

| Feature | Env Var | Default |
|---------|---------|---------|
| Sermons | `FEATURE_SERMONS` | on |
| Groups | `FEATURE_GROUPS` | on |
| Resource Hub | `FEATURE_RESOURCE_HUB` | on |
| Communication | `FEATURE_COMMUNICATION` | on |
| Events | `FEATURE_EVENTS` | on |
| Giving | `FEATURE_GIVING` | off |
| Member Care | `FEATURE_MEMBER_CARE` | off |
| AI Assist | `ENABLE_AI` | off |
| Federation | `FEATURE_CONNECT` | off |
| SMS *(planned — no delivery provider wired yet)* | `FEATURE_SMS` | off |

## User Roles

- **admin** -- Full access. Manage users, settings, all features.
- **pastor** -- Access to member care, prayer requests (pastor-only), and all content management.
- **member** -- Standard access. Can join groups, RSVP to events, submit prayer requests, view resources.

## Website Builder

1. Go to **Pages** in the dashboard
2. Create a new page or start from a template
3. Edit content using the block editor
4. Set page slug and visibility
5. Manage theme colors and fonts under **Settings > Theme**

Templates are seeded for common pages (homepage, about, sermons, events).

## Resource Hub

Community resources are publicly searchable. Moderation workflow:

1. Community members submit resources via the public form
2. Submissions appear in **Submissions** queue
3. Admin reviews, edits if needed, and approves or rejects
4. Approved resources appear in the public directory
5. Featured resources are highlighted on the homepage

## Communication

- **Email**: Configure SMTP in `.env`. Send messages to individuals or groups.
- **Push Notifications**: Generate VAPID keys (`npx web-push generate-vapid-keys`), set in `.env`. Users opt in via the PWA.

## Groups

- Create groups with type: small_group, bible_study, committee, ministry, class
- Set visibility (public or members-only)
- Leaders can manage members, post materials, use group chat
- Meeting schedule and location are displayed on the group page

## Giving

When enabled (`FEATURE_GIVING=true`):

1. Create funds (General Fund, Building Fund, Missions, etc.)
2. Set optional goals for campaigns
3. Members can record donations against specific funds
4. Generate giving statements for tax purposes

## Events

- Create events with date, location, and visibility
- Enable registration with optional capacity limits
- Add volunteer slots with role descriptions
- Recurring events support weekly/monthly patterns
- Bookable resources (rooms, vehicles) can be reserved

## Prayer Wall

- Members submit prayer requests with category and visibility level
- `pastor_only` requests are visible only to pastor/admin roles
- `congregation` requests appear on the prayer wall
- Community members can indicate they've prayed (prayer count)

## Sermon Archive

- Upload sermon metadata with audio/video URLs
- Organize into series
- Auto-generate podcast RSS feed (`podcastInclude: true`)
- AI summaries and key takeaways (when AI is enabled)

## Federation (Connect)

**Experimental.** Inbound peer messages are signature-verified with replay
protection, but outbound peer fan-out is not yet implemented — keep
`FEATURE_CONNECT` off outside of testing. When enabled, OpusHeart instances are
intended to share resources and events:

1. Enable `FEATURE_CONNECT=true`
2. Go to **Settings > Federation**
3. Add peer instances by URL
4. Exchange verification keys
5. Shared resources appear in federated search results

## Data Privacy (GDPR)

- Members can export their data via **Settings > Privacy > Export My Data**
- Members can request account deletion. Erasure is **immediate and irreversible**: personal data is deleted, while donations and any federated prayers are anonymized (donor link severed) to satisfy tax/charitable retention law. See [privacy-and-data.md](privacy-and-data.md).
- PII is encrypted at rest (AES-256-GCM) using the `ENCRYPTION_KEY`; lookup indexes use a keyed HMAC derived from the same key, not a plain hash
- Audit log tracks data access and modifications
