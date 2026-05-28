import mongoose, { Schema, Document, Types } from 'mongoose';
import { encryptRecordValues, decryptRecordValues } from './plugins/encryption.plugin.js';

const getEncKey = (): string => {
  const key = process.env['ENCRYPTION_KEY'];
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  return key;
};

export interface IMember {
  userId: Types.ObjectId;
  householdId?: Types.ObjectId;
  joinedAt: Date;
  membershipStatus: 'active' | 'inactive' | 'visitor' | 'archived';
  customFields: Map<string, string | number | boolean>;
  groups: Types.ObjectId[];
  attendanceOptIn: boolean;
}

export interface IMemberDocument extends IMember, Document {}

const memberSchema = new Schema<IMemberDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', index: true },
    joinedAt: { type: Date, default: () => new Date() },
    membershipStatus: {
      type: String,
      enum: ['active', 'inactive', 'visitor', 'archived'],
      default: 'visitor',
      index: true,
    },
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
      default: () => new Map(),
    },
    groups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
    attendanceOptIn: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// customFields is an unbounded key/value store an admin can put anything into
// (dietary/medical notes, etc.), so its string values are encrypted at rest.
// Encryption happens here because the whole map is rewritten from validated
// plaintext on each update (see MemberService.update), avoiding the partial-
// update double-encryption hazard a per-field plugin would have.
memberSchema.pre('save', function () {
  if (this.isModified('customFields') && this.customFields) {
    const encrypted = encryptRecordValues(this.customFields as unknown as Map<string, unknown>, getEncKey());
    this.set('customFields', new Map(Object.entries(encrypted)));
  }
});

function decryptCustomFields(ret: Record<string, unknown>): void {
  if (ret['customFields']) {
    ret['customFields'] = decryptRecordValues(
      ret['customFields'] as Record<string, unknown> | Map<string, unknown>,
      getEncKey(),
    );
  }
}

memberSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    decryptCustomFields(ret);
    ret['id'] = ret['_id'];
    delete ret['_id'];
    delete ret['__v'];
    return ret;
  },
});

memberSchema.set('toObject', {
  transform: (_doc: any, ret: any) => {
    decryptCustomFields(ret);
    ret['id'] = ret['_id'];
    delete ret['_id'];
    return ret;
  },
});

export const Member = mongoose.model<IMemberDocument>('Member', memberSchema);
