import mongoose, { Schema, Document, Types } from 'mongoose';
import type { ResourceCategory } from '@opusheart/shared';

export interface IResourceSubmission {
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
    coordinates: [number, number];
  };
  languages: string[];
  tags: string[];
  // Submitter info (public submissions — no auth required)
  submittedBy?: Types.ObjectId;
  submitterName: string;
  submitterEmail: string;
  // Moderation
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
}

export interface IResourceSubmissionDocument extends IResourceSubmission, Document {}

const resourceSubmissionSchema = new Schema<IResourceSubmissionDocument>(
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
    tags: { type: [String], default: [] },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submitterName: { type: String, required: true },
    submitterEmail: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String },
  },
  { timestamps: true }
);

resourceSubmissionSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    if (ret['location'] && ret['location']['coordinates']) {
      ret['location'] = {
        lng: ret['location']['coordinates'][0],
        lat: ret['location']['coordinates'][1],
      };
    }
    return ret;
  },
});

resourceSubmissionSchema.set('toObject', {
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

export const ResourceSubmission = mongoose.model<IResourceSubmissionDocument>(
  'ResourceSubmission',
  resourceSubmissionSchema
);
