import mongoose, { Schema, Document } from 'mongoose';

/**
 * Append-only record of a consent decision. Unlike the current-state flags on
 * the User (privacySettings), this preserves the HISTORY of consent changes —
 * who consented to what, when, and from where — which is what GDPR
 * accountability (Art. 7(1) "be able to demonstrate consent") actually requires.
 */
export interface IConsentRecord {
  userId: mongoose.Types.ObjectId;
  type: 'care_tracking' | 'directory' | 'show_email' | 'show_phone';
  granted: boolean;
  source: string;          // e.g. 'self-service', 'admin', 'registration'
  ip?: string;
  createdAt: Date;
}

export interface IConsentRecordDocument extends IConsentRecord, Document {}

export const CONSENT_TYPES = ['care_tracking', 'directory', 'show_email', 'show_phone'] as const;

const consentRecordSchema = new Schema<IConsentRecordDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, enum: CONSENT_TYPES },
    granted: { type: Boolean, required: true },
    source: { type: String, required: true, default: 'self-service' },
    ip: { type: String },
  },
  // Append-only: created timestamp only, never updated.
  { timestamps: { createdAt: true, updatedAt: false } }
);

consentRecordSchema.index({ userId: 1, type: 1, createdAt: -1 });

consentRecordSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const ConsentRecord = mongoose.model<IConsentRecordDocument>('ConsentRecord', consentRecordSchema);
