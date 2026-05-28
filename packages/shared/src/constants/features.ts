import type { FeatureToggles } from '../types/common.js';

export const DEFAULT_FEATURES: FeatureToggles = {
  giving: false,
  attendance: false,
  memberCare: false,
  sms: false,
  connect: false,
  ai: false,
  sermons: true,
  groups: true,
  resourceHub: true,
  communication: true,
  events: true,
};

export const ALL_FEATURES = Object.keys(DEFAULT_FEATURES) as (keyof FeatureToggles)[];
