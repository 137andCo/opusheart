import mongoose, { Schema, Document } from 'mongoose';

export interface IVolunteerSlot {
  role: string;
  needed: number;
  filled: mongoose.Types.ObjectId[];
}

export interface IRsvp {
  userId: mongoose.Types.ObjectId;
  status: 'yes' | 'no' | 'maybe';
  headcount: number;
  respondedAt: Date;
}

export interface IRecurrenceRule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  interval: number;
  dayOfWeek?: number[];
  endDate?: Date;
  exceptions: Date[];
}

export interface IEvent {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location: string;
  recurring?: IRecurrenceRule;
  visibility: 'public' | 'members' | 'leaders';
  volunteerSlots: IVolunteerSlot[];
  rsvps: IRsvp[];
  bookedResources: mongoose.Types.ObjectId[];
  maxAttendees?: number;
  registrationRequired: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEventDocument extends IEvent, Document {}

const volunteerSlotSchema = new Schema<IVolunteerSlot>(
  {
    role: { type: String, required: true },
    needed: { type: Number, required: true },
    filled: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
  },
  { _id: false }
);

const rsvpSchema = new Schema<IRsvp>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    status: { type: String, required: true, enum: ['yes', 'no', 'maybe'] },
    headcount: { type: Number, required: true, default: 1 },
    respondedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const recurrenceRuleSchema = new Schema<IRecurrenceRule>(
  {
    frequency: {
      type: String,
      required: true,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'],
    },
    interval: { type: Number, required: true, default: 1 },
    dayOfWeek: { type: [Number] },
    endDate: { type: Date },
    exceptions: { type: [Date], default: [] },
  },
  { _id: false }
);

const eventSchema = new Schema<IEventDocument>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    location: { type: String, required: true },
    recurring: { type: recurrenceRuleSchema },
    visibility: {
      type: String,
      required: true,
      enum: ['public', 'members', 'leaders'],
      default: 'members',
      index: true,
    },
    volunteerSlots: { type: [volunteerSlotSchema], default: [] },
    rsvps: { type: [rsvpSchema], default: [] },
    bookedResources: [{ type: Schema.Types.ObjectId, ref: 'Resource' }],
    maxAttendees: { type: Number },
    registrationRequired: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ visibility: 1, startDate: 1 });
eventSchema.index({ 'rsvps.userId': 1 });

eventSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const Event = mongoose.model<IEventDocument>('Event', eventSchema);
