import mongoose, { Schema, Document, Types } from 'mongoose';
import type { ResourceCategory } from '@opusheart/shared';

export interface IResource {
  name: string;
  description: string;
  category: ResourceCategory;
  subcategory?: string;
  provider: string;
  eligibility: string;
  hours: string;
  phone?: string;
  email?: string;
  website?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat] for GeoJSON
  };
  languages: string[];
  lastVerified: Date;
  verifiedBy?: Types.ObjectId;
  submittedBy: Types.ObjectId;
  approved: boolean;
  featured: boolean;
  tags: string[];
  aiSummary?: string;
}

export interface IResourceDocument extends IResource, Document {}

const resourceSchema = new Schema<IResourceDocument>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: [
        'food', 'housing', 'utilities', 'medical', 'mental_health',
        'employment', 'education', 'legal', 'transportation', 'clothing',
        'financial', 'childcare', 'senior_services', 'disability',
        'substance_abuse', 'domestic_violence', 'veterans', 'other',
      ],
      index: true,
    },
    subcategory: { type: String },
    provider: { type: String, required: true },
    eligibility: { type: String, required: true },
    hours: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    website: { type: String },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
      country: { type: String, required: true, default: 'US' },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },
    languages: { type: [String], default: ['en'] },
    lastVerified: { type: Date, default: Date.now },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approved: { type: Boolean, default: false, index: true },
    featured: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    aiSummary: { type: String },
  },
  { timestamps: true }
);

// Text index for full-text search
resourceSchema.index({ name: 'text', description: 'text', provider: 'text', tags: 'text' });

// Compound indexes for filtered listing + sort
resourceSchema.index({ category: 1, approved: 1 });
resourceSchema.index({ approved: 1, featured: 1, createdAt: -1 });
resourceSchema.index({ approved: 1, createdAt: -1 });

// Geo index for nearby queries
resourceSchema.index({ location: '2dsphere' });

resourceSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    // Convert GeoJSON back to simple lat/lng for API consumers
    if (ret['location'] && ret['location']['coordinates']) {
      ret['location'] = {
        lng: ret['location']['coordinates'][0],
        lat: ret['location']['coordinates'][1],
      };
    }
    return ret;
  },
});

resourceSchema.set('toObject', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    if (ret['location'] && ret['location']['coordinates']) {
      ret['location'] = {
        lng: ret['location']['coordinates'][0],
        lat: ret['location']['coordinates'][1],
      };
    }
    return ret;
  },
});

export const Resource = mongoose.model<IResourceDocument>('Resource', resourceSchema);
