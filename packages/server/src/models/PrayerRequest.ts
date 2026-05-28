import mongoose, { Schema, Document } from 'mongoose';

export interface IPrayerRequest {
  content: string;
  category: 'health' | 'family' | 'provision' | 'gratitude' | 'grief' | 'community' | 'guidance' | 'other';
  submittedBy: mongoose.Types.ObjectId;
  anonymous: boolean;
  visibility: 'pastor_only' | 'congregation' | 'mesh';
  meshEnabled: boolean;
  prayerCount: number;
  status: 'active' | 'answered' | 'archived';
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPrayerRequestDocument extends IPrayerRequest, Document {}

const prayerRequestSchema = new Schema<IPrayerRequestDocument>(
  {
    content: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ['health', 'family', 'provision', 'gratitude', 'grief', 'community', 'guidance', 'other'],
      default: 'other',
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    anonymous: { type: Boolean, default: true },
    visibility: {
      type: String,
      required: true,
      enum: ['pastor_only', 'congregation', 'mesh'],
      default: 'congregation',
    },
    meshEnabled: { type: Boolean, default: false },
    prayerCount: { type: Number, default: 0 },
    status: {
      type: String,
      required: true,
      enum: ['active', 'answered', 'archived'],
      default: 'active',
    },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

prayerRequestSchema.index({ category: 1, status: 1 });
prayerRequestSchema.index({ submittedBy: 1 });
prayerRequestSchema.index({ visibility: 1, status: 1 });

prayerRequestSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const PrayerRequest = mongoose.model<IPrayerRequestDocument>('PrayerRequest', prayerRequestSchema);
