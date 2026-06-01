import mongoose, { Schema, Document } from 'mongoose';

export interface ITheme {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl?: string;
  faviconUrl?: string;
  customCss?: string;
}

export interface IThemeDocument extends ITheme, Document {}

const themeSchema = new Schema<IThemeDocument>(
  {
    primaryColor: { type: String, default: '#a8502f' },
    secondaryColor: { type: String, default: '#6e8160' },
    fontFamily: { type: String, default: 'Inter, sans-serif' },
    logoUrl: { type: String },
    faviconUrl: { type: String },
    customCss: { type: String, default: '' },
  },
  { timestamps: true }
);

themeSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

themeSchema.set('toObject', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    return ret;
  },
});

export const Theme = mongoose.model<IThemeDocument>('Theme', themeSchema);
