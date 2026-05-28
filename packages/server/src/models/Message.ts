import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageAudience {
  type: 'all' | 'group' | 'role' | 'custom';
  groupIds?: mongoose.Types.ObjectId[];
  roles?: string[];
  memberIds?: mongoose.Types.ObjectId[];
}

export interface IDeliveryStats {
  total: number;
  delivered: number;
  failed: number;
  opened: number;
}

export interface IMessage {
  subject: string;
  body: string;
  bodyPlain: string;
  channel: 'email' | 'push' | 'sms' | 'announcement';
  audience: IMessageAudience;
  sentBy: mongoose.Types.ObjectId;
  scheduledFor?: Date;
  sentAt?: Date;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  deliveryStats?: IDeliveryStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageDocument extends IMessage, Document {}

const audienceSchema = new Schema({
  type: { type: String, enum: ['all', 'group', 'role', 'custom'], required: true },
  groupIds: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
  roles: [String],
  memberIds: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
}, { _id: false });

const deliveryStatsSchema = new Schema({
  total: { type: Number, default: 0 },
  delivered: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  opened: { type: Number, default: 0 },
}, { _id: false });

const messageSchema = new Schema<IMessageDocument>({
  subject: { type: String, required: true, maxlength: 200 },
  body: { type: String, required: true, maxlength: 50000 },
  bodyPlain: { type: String, default: '', maxlength: 50000 },
  channel: { type: String, enum: ['email', 'push', 'sms', 'announcement'], required: true },
  audience: { type: audienceSchema, required: true },
  sentBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledFor: Date,
  sentAt: Date,
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'],
    default: 'draft',
    index: true,
  },
  deliveryStats: deliveryStatsSchema,
}, { timestamps: true });

messageSchema.index({ sentBy: 1, status: 1 });
messageSchema.index({ status: 1, createdAt: -1 });
messageSchema.index({ scheduledFor: 1 }, { sparse: true });

messageSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

export const Message = mongoose.model<IMessageDocument>('Message', messageSchema);
