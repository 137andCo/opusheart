import mongoose, { Schema, Document } from 'mongoose';

export interface ISermonSeries {
  title: string;
  description: string;
  imageUrl?: string;
  startDate: Date;
  endDate?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISermonSeriesDocument extends ISermonSeries, Document {}

const sermonSeriesSchema = new Schema<ISermonSeriesDocument>(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    imageUrl: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

sermonSeriesSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const SermonSeries = mongoose.model<ISermonSeriesDocument>('SermonSeries', sermonSeriesSchema);
