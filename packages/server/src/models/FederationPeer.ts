import mongoose, { Schema, Document } from 'mongoose';

export interface IFederationPeer {
  instanceUrl: string;
  instanceName: string;
  publicKey: string;
  trustLevel: 'pending' | 'trusted' | 'blocked';
  participationLevel: 'isolated' | 'prayer_only' | 'mutual_aid' | 'full_mesh' | 'custom';
  connectedAt: Date;
  lastSeenAt: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFederationPeerDocument extends IFederationPeer, Document {}

const federationPeerSchema = new Schema<IFederationPeerDocument>(
  {
    instanceUrl: { type: String, required: true, unique: true },
    instanceName: { type: String, required: true },
    publicKey: { type: String, required: true },
    trustLevel: {
      type: String,
      required: true,
      enum: ['pending', 'trusted', 'blocked'],
      default: 'pending',
      index: true,
    },
    participationLevel: {
      type: String,
      required: true,
      enum: ['isolated', 'prayer_only', 'mutual_aid', 'full_mesh', 'custom'],
      default: 'prayer_only',
    },
    connectedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

federationPeerSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const FederationPeer = mongoose.model<IFederationPeerDocument>('FederationPeer', federationPeerSchema);
