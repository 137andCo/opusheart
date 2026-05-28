import mongoose, { Schema, Document } from 'mongoose';

export interface IEmergencyPledge {
  instanceId: string;
  instanceName: string;
  quantity: number;
  unit?: string;
  status: 'pledged' | 'in_transit' | 'delivered';
  pledgedAt: Date;
}

export interface IEmergencyNeed {
  type: string;
  description: string;
  quantity?: number;
  unit?: string;
  fulfilled: number;
  pledges: IEmergencyPledge[];
}

export interface IEmergencyBroadcast {
  originInstanceId: string;
  originInstanceName: string;
  severity: 'need' | 'urgent' | 'disaster';
  title: string;
  description: string;
  needs: IEmergencyNeed[];
  location: {
    city: string;
    state: string;
    country: string;
    coordinates?: { lat: number; lng: number };
  };
  contactMethod: string;
  expiresAt: Date;
  hopCount: number;
  maxHops: number;
  signature: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmergencyBroadcastDocument extends IEmergencyBroadcast, Document {}

const emergencyPledgeSchema = new Schema<IEmergencyPledge>(
  {
    instanceId: { type: String, required: true },
    instanceName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['pledged', 'in_transit', 'delivered'],
      default: 'pledged',
    },
    pledgedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const emergencyNeedSchema = new Schema<IEmergencyNeed>(
  {
    type: { type: String, required: true },
    description: { type: String, required: true },
    quantity: { type: Number },
    unit: { type: String },
    fulfilled: { type: Number, default: 0 },
    pledges: { type: [emergencyPledgeSchema], default: [] },
  },
  { _id: false }
);

const emergencyBroadcastSchema = new Schema<IEmergencyBroadcastDocument>(
  {
    originInstanceId: { type: String, required: true },
    originInstanceName: { type: String, required: true },
    severity: {
      type: String,
      required: true,
      enum: ['need', 'urgent', 'disaster'],
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    needs: { type: [emergencyNeedSchema], required: true },
    location: {
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true, default: 'US' },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },
    contactMethod: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    hopCount: { type: Number, required: true, default: 0 },
    maxHops: { type: Number, required: true, default: 3 },
    signature: { type: String, required: true },
  },
  { timestamps: true }
);

emergencyBroadcastSchema.index({ severity: 1, createdAt: -1 });
emergencyBroadcastSchema.index({ expiresAt: 1 });
// Replay/dedup protection: a given signed broadcast from a given origin can only
// be stored once, no matter how many times a peer re-POSTs it.
emergencyBroadcastSchema.index({ originInstanceId: 1, signature: 1 }, { unique: true });

emergencyBroadcastSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const EmergencyBroadcast = mongoose.model<IEmergencyBroadcastDocument>('EmergencyBroadcast', emergencyBroadcastSchema);
