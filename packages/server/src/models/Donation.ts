import mongoose, { Schema, Document } from 'mongoose';
import { encryptionPlugin } from './plugins/encryption.plugin.js';

export interface IDonation {
  memberId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  fund: mongoose.Types.ObjectId;
  method: 'online' | 'cash' | 'check' | 'other';
  recurring: boolean;
  recurringSchedule?: 'weekly' | 'biweekly' | 'monthly';
  processorId?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  date: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDonationDocument extends IDonation, Document {}

const donationSchema = new Schema<IDonationDocument>(
  {
    memberId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD', trim: true },
    fund: { type: Schema.Types.ObjectId, ref: 'Fund', required: true },
    method: {
      type: String,
      required: true,
      enum: ['online', 'cash', 'check', 'other'],
      default: 'online',
    },
    recurring: { type: Boolean, default: false },
    recurringSchedule: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly'],
    },
    processorId: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'completed',
    },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

donationSchema.index({ memberId: 1, date: -1 });
donationSchema.index({ fund: 1, date: -1 });
donationSchema.index({ status: 1 });

donationSchema.plugin(encryptionPlugin, {
  fields: ['notes'],
  hashFields: [],
});

donationSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const Donation = mongoose.model<IDonationDocument>('Donation', donationSchema);
