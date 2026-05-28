export type UserRole = 'admin' | 'pastor' | 'leader' | 'member' | 'visitor';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  pastor: 80,
  leader: 60,
  member: 40,
  visitor: 20,
};

export interface User {
  id: string;
  email: string;
  emailHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  phoneHash?: string;
  role: UserRole;
  mfaEnabled: boolean;
  mfaSecret?: string;
  avatar?: string;
  locale: string;
  timezone: string;
  privacySettings: PrivacySettings;
  active: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrivacySettings {
  showInDirectory: boolean;
  showEmail: boolean;
  showPhone: boolean;
  allowCareTracking: boolean;
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  showInDirectory: false,
  showEmail: false,
  showPhone: false,
  allowCareTracking: false,
};
