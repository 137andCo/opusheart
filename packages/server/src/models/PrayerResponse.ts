import mongoose, { Schema, Document } from 'mongoose';

export interface IPrayerResponse {
  prayerRequestId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: 'prayed' | 'message';
  message?: string;
  createdAt: Date;
}

export interface IPrayerResponseDocument extends IPrayerResponse, Document {}

const prayerResponseSchema = new Schema<IPrayerResponseDocument>(
  {
    prayerRequestId: { type: Schema.Types.ObjectId, ref: 'PrayerRequest', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['prayed', 'message'] },
    message: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

prayerResponseSchema.index({ prayerRequestId: 1, userId: 1 });

prayerResponseSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const PrayerResponse = mongoose.model<IPrayerResponseDocument>('PrayerResponse', prayerResponseSchema);
