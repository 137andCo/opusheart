import mongoose, { Schema, Document } from 'mongoose';

export interface IFund {
  name: string;
  description: string;
  goal?: number;
  raised: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFundDocument extends IFund, Document {}

const fundSchema = new Schema<IFundDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    goal: { type: Number, min: 0 },
    raised: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

fundSchema.index({ active: 1 });

fundSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const Fund = mongoose.model<IFundDocument>('Fund', fundSchema);
