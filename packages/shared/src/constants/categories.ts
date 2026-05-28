export const RESOURCE_CATEGORIES = [
  'food',
  'housing',
  'utilities',
  'medical',
  'mental_health',
  'employment',
  'education',
  'legal',
  'transportation',
  'clothing',
  'financial',
  'childcare',
  'senior_services',
  'disability',
  'substance_abuse',
  'domestic_violence',
  'veterans',
  'other',
] as const;

type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  food: 'Food Assistance',
  housing: 'Housing & Shelter',
  utilities: 'Utility Assistance',
  medical: 'Medical Care',
  mental_health: 'Mental Health',
  employment: 'Employment & Job Training',
  education: 'Education',
  legal: 'Legal Aid',
  transportation: 'Transportation',
  clothing: 'Clothing',
  financial: 'Financial Assistance',
  childcare: 'Childcare',
  senior_services: 'Senior Services',
  disability: 'Disability Services',
  substance_abuse: 'Substance Abuse Recovery',
  domestic_violence: 'Domestic Violence Support',
  veterans: 'Veterans Services',
  other: 'Other',
};

export const PRAYER_CATEGORIES = [
  'health',
  'family',
  'provision',
  'gratitude',
  'grief',
  'community',
  'guidance',
  'other',
] as const;

type PrayerCategory = (typeof PRAYER_CATEGORIES)[number];

export const PRAYER_CATEGORY_LABELS: Record<PrayerCategory, string> = {
  health: 'Health & Healing',
  family: 'Family',
  provision: 'Provision & Needs',
  gratitude: 'Gratitude & Praise',
  grief: 'Grief & Loss',
  community: 'Community',
  guidance: 'Guidance & Wisdom',
  other: 'Other',
};

export const GROUP_TYPES = [
  'small_group',
  'bible_study',
  'committee',
  'ministry',
  'team',
  'class',
  'custom',
] as const;

type GroupType = (typeof GROUP_TYPES)[number];

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  small_group: 'Small Group',
  bible_study: 'Bible Study',
  committee: 'Committee',
  ministry: 'Ministry',
  team: 'Team',
  class: 'Class',
  custom: 'Custom',
};

export const CARE_NOTE_TYPES = [
  'visit',
  'hospital',
  'bereavement',
  'meal_train',
  'follow_up',
  'general',
] as const;
