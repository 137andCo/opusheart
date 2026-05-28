export type PrayerCategory =
  | 'health'
  | 'family'
  | 'provision'
  | 'gratitude'
  | 'grief'
  | 'community'
  | 'guidance'
  | 'other';

export type PrayerVisibility = 'pastor_only' | 'congregation' | 'mesh';

export type PrayerStatus = 'active' | 'answered' | 'archived';

export interface PrayerRequest {
  id: string;
  content: string;
  category: PrayerCategory;
  submittedBy: string;
  anonymous: boolean;
  visibility: PrayerVisibility;
  meshEnabled: boolean;
  prayerCount: number;
  status: PrayerStatus;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrayerResponse {
  id: string;
  prayerRequestId: string;
  userId: string;
  type: 'prayed' | 'message';
  message?: string;
  createdAt: Date;
}
