import mongoose, { Schema, Document } from 'mongoose';

export interface IBooking {
  resource: mongoose.Types.ObjectId;
  event?: mongoose.Types.ObjectId;
  title: string;
  startTime: Date;
  endTime: Date;
  bookedBy: mongoose.Types.ObjectId;
  notes?: string;
  status: 'confirmed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface IBookingDocument extends IBooking, Document {}

const bookingSchema = new Schema<IBookingDocument>(
  {
    resource: { type: Schema.Types.ObjectId, ref: 'BookableResource', required: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event' },
    title: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    bookedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed',
    },
  },
  { timestamps: true }
);

bookingSchema.index({ resource: 1, startTime: 1, endTime: 1 });

bookingSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const Booking = mongoose.model<IBookingDocument>('Booking', bookingSchema);
