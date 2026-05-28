import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPage {
  title: string;
  slug: string;
  content: unknown[];
  status: 'draft' | 'published' | 'archived';
  template?: string;
  seo: {
    title?: string;
    description?: string;
    ogImage?: string;
    noIndex: boolean;
  };
  locale: string;
  translations: Map<string, string>;
  publishedAt?: Date;
  publishedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
}

export interface IPageDocument extends IPage, Document {}

const pageSchema = new Schema<IPageDocument>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    content: { type: Schema.Types.Mixed, default: [] },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    template: { type: String },
    seo: {
      title: { type: String },
      description: { type: String },
      ogImage: { type: String },
      noIndex: { type: Boolean, default: false },
    },
    locale: { type: String, default: 'en', index: true },
    translations: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Text index for search
pageSchema.index({ title: 'text', slug: 'text' });

pageSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

pageSchema.set('toObject', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    return ret;
  },
});

export const Page = mongoose.model<IPageDocument>('Page', pageSchema);
