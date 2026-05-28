import { ConsentRecord, type IConsentRecordDocument } from '../models/ConsentRecord.js';

type ConsentType = 'care_tracking' | 'directory' | 'show_email' | 'show_phone';

// Maps a User.privacySettings field to its consent type.
const PRIVACY_FIELD_TO_CONSENT: Record<string, ConsentType> = {
  allowCareTracking: 'care_tracking',
  showInDirectory: 'directory',
  showEmail: 'show_email',
  showPhone: 'show_phone',
};

export class ConsentService {
  /**
   * Record a single consent decision (append-only history).
   */
  async record(userId: string, type: ConsentType, granted: boolean, source: string, ip?: string): Promise<IConsentRecordDocument> {
    return ConsentRecord.create({ userId, type, granted, source, ip });
  }

  /**
   * Given a privacySettings patch, write a consent record for each field that is
   * present. Called whenever a user updates their privacy settings so the change
   * history is preserved alongside the current-state flags on the User.
   */
  async recordPrivacyChanges(
    userId: string,
    privacySettings: Record<string, unknown> | undefined,
    source: string,
    ip?: string,
  ): Promise<void> {
    if (!privacySettings) return;
    const records = Object.entries(privacySettings)
      .filter(([field, value]) => field in PRIVACY_FIELD_TO_CONSENT && typeof value === 'boolean')
      .map(([field, value]) => ({
        userId, type: PRIVACY_FIELD_TO_CONSENT[field]!, granted: value as boolean, source, ip,
      }));
    if (records.length > 0) {
      await ConsentRecord.insertMany(records);
    }
  }

  /**
   * Full consent history for a user, newest first.
   */
  async history(userId: string): Promise<IConsentRecordDocument[]> {
    return ConsentRecord.find({ userId }).sort({ createdAt: -1 }).limit(1000);
  }
}

export const consentService = new ConsentService();
