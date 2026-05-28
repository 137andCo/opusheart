export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditFields {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface FeatureToggles {
  giving: boolean;
  attendance: boolean;
  memberCare: boolean;
  sms: boolean;
  connect: boolean;
  ai: boolean;
  sermons: boolean;
  groups: boolean;
  resourceHub: boolean;
  communication: boolean;
  events: boolean;
}

export type Vertical = 'church' | 'community' | 'nonprofit' | 'custom';

export interface InstanceSettings {
  id: string;
  instanceName: string;
  instanceUrl: string;
  vertical: Vertical;
  features: FeatureToggles;
  locale: string;
  timezone: string;
  branding: BrandingConfig;
}

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
  customCss?: string;
}

export interface VerticalConfig {
  name: Vertical;
  label: string;
  roleLabels: Record<string, string>;
  defaultFeatures: FeatureToggles;
  terminology: Record<string, string>;
  templates: string[];
  blocks: string[];
}
