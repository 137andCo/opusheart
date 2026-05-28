import mongoose, { Schema, Document } from 'mongoose';

export interface IBookableResource {
  name: string;
  type: 'room' | 'vehicle' | 'equipment' | 'other';
  description?: string;
  capacity?: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBookableResourceDocument extends IBookableResource, Document {}

const bookableResourceSchema = new Schema<IBookableResourceDocument>(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['room', 'vehicle', 'equipment', 'other'],
    },
    description: { type: String },
    capacity: { type: Number },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bookableResourceSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const BookableResource = mongoose.model<IBookableResourceDocument>('BookableResource', bookableResourceSchema);
