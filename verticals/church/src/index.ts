import type { VerticalConfig } from '@opusheart/shared';

/**
 * Church vertical preset.
 *
 * A vertical bundles the defaults that make a fresh instance feel native to its
 * audience: what the roles are called, which features ship on, the words the UI
 * uses ("Congregation" rather than "Members"), and which page templates/blocks
 * the builder offers. The server resolves the active preset from the `VERTICAL`
 * env var and exposes it at `GET /api/vertical` for the web + dashboard to use.
 */
export const churchVertical: VerticalConfig = {
  name: 'church',
  label: 'Church',
  roleLabels: {
    admin: 'Administrator',
    pastor: 'Pastor',
    leader: 'Ministry Leader',
    member: 'Member',
    visitor: 'Visitor',
  },
  defaultFeatures: {
    sermons: true,
    groups: true,
    events: true,
    resourceHub: true,
    communication: true,
    giving: false,
    attendance: false,
    memberCare: false,
    sms: false,
    connect: false,
    ai: false,
  },
  terminology: {
    members: 'Congregation',
    member: 'Member',
    groups: 'Ministries',
    group: 'Ministry',
    events: 'Services & Events',
    care: 'Pastoral Care',
    giving: 'Giving',
    resources: 'Community Resources',
    leaders: 'Ministry Leaders',
    directory: 'Church Directory',
  },
  templates: ['church-homepage', 'about', 'sermons', 'events'],
  blocks: ['hero', 'heading', 'paragraph', 'image'],
};

/** Kept for backwards-compatibility with the original stub export. */
export const VERTICAL = 'church';

export default churchVertical;
