import mongoose, { Schema, Document } from 'mongoose';

export interface IPageTemplate {
  name: string;
  description: string;
  vertical: string;
  thumbnail?: string;
  content: unknown[];
  category: string;
}

export interface IPageTemplateDocument extends IPageTemplate, Document {}

const pageTemplateSchema = new Schema<IPageTemplateDocument>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    vertical: { type: String, required: true, index: true },
    thumbnail: { type: String },
    content: { type: Schema.Types.Mixed, default: [] },
    category: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

pageTemplateSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

pageTemplateSchema.set('toObject', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    return ret;
  },
});

export const PageTemplate = mongoose.model<IPageTemplateDocument>('PageTemplate', pageTemplateSchema);
