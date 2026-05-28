import mongoose, { Schema, Document } from 'mongoose';

export interface ISermon {
  title: string;
  speaker: string;
  date: Date;
  series?: mongoose.Types.ObjectId;
  seriesOrder?: number;
  description: string;
  scriptureReferences: string[];
  audioUrl?: string;
  videoUrl?: string;
  notes?: string;
  outline?: string;
  aiSummary?: string;
  aiKeyTakeaways?: string[];
  tags: string[];
  published: boolean;
  podcastInclude: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISermonDocument extends ISermon, Document {}

const sermonSchema = new Schema<ISermonDocument>(
  {
    title: { type: String, required: true },
    speaker: { type: String, required: true },
    date: { type: Date, required: true },
    series: { type: Schema.Types.ObjectId, ref: 'SermonSeries' },
    seriesOrder: { type: Number },
    description: { type: String, default: '' },
    scriptureReferences: { type: [String], default: [] },
    audioUrl: { type: String },
    videoUrl: { type: String },
    notes: { type: String },
    outline: { type: String },
    aiSummary: { type: String },
    aiKeyTakeaways: { type: [String] },
    tags: { type: [String], default: [] },
    published: { type: Boolean, default: false },
    podcastInclude: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

sermonSchema.index({ title: 'text', description: 'text' });
sermonSchema.index({ date: -1 });
sermonSchema.index({ series: 1, seriesOrder: 1 });
sermonSchema.index({ published: 1 });
sermonSchema.index({ published: 1, date: -1 });

sermonSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const Sermon = mongoose.model<ISermonDocument>('Sermon', sermonSchema);
