export type MembershipStatus = 'active' | 'inactive' | 'visitor' | 'archived';

export interface Member {
  id: string;
  userId: string;
  householdId?: string;
  joinedAt: Date;
  membershipStatus: MembershipStatus;
  customFields: Record<string, string | number | boolean>;
  groups: string[];
  attendanceOptIn: boolean;
}

export interface Household {
  id: string;
  name: string;
  members: string[];
  address?: EncryptedAddress;
  createdAt: Date;
  updatedAt: Date;
}

export interface EncryptedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface MemberCareNote {
  id: string;
  memberId: string;
  authorId: string;
  type: CareNoteType;
  content: string;
  followUpDate?: Date;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CareNoteType =
  | 'visit'
  | 'hospital'
  | 'bereavement'
  | 'meal_train'
  | 'follow_up'
  | 'general';
