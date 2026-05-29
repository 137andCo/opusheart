import mongoose, { Schema, Document, Types } from 'mongoose';
import { encrypt, decrypt } from '@opusheart/shared';
import { blindIndex } from '../utils/blindIndex.js';

export interface IHousehold {
  name: string;
  members: Types.ObjectId[];
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    zipHash?: string;
    country: string;
  };
}

export interface IHouseholdDocument extends IHousehold, Document {}

const householdSchema = new Schema<IHouseholdDocument>(
  {
    name: { type: String, required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
      zipHash: { type: String, index: true, sparse: true },
      country: { type: String, default: 'US' },
    },
  },
  { timestamps: true }
);

const addressFields = ['street', 'city', 'state', 'zip', 'country'];

const getKey = (): string => {
  const key = process.env['ENCRYPTION_KEY'];
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  return key;
};

// Encrypt address fields on save
householdSchema.pre('save', function () {
  if (!this.address) return;
  const key = getKey();
  for (const field of addressFields) {
    const value = this.get(`address.${field}`) as string | undefined;
    if (value && this.isModified(`address.${field}`)) {
      if (field === 'zip') {
        this.set('address.zipHash', blindIndex(value));
      }
      this.set(`address.${field}`, encrypt(value, key));
    }
  }
});

// Decrypt address fields in toJSON/toObject
function decryptAddress(ret: Record<string, unknown>): void {
  const addr = ret['address'] as Record<string, unknown> | undefined;
  if (!addr) return;
  const key = getKey();
  for (const field of addressFields) {
    const value = addr[field];
    if (typeof value === 'string' && value.length > 0) {
      try {
        addr[field] = decrypt(value, key);
      } catch {
        // Address fields legitimately mix ciphertext with plaintext: `country`
        // carries a schema default ('US') that is never encrypted, so a decrypt
        // failure here is expected for defaulted/plaintext values, not an
        // integrity signal. Leave the value as-is. (Uniformly-encrypted fields
        // fail closed in encryption.plugin.ts.)
      }
    }
  }
}

householdSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    decryptAddress(ret);
    delete ret['__v'];
    ret['id'] = ret['_id'];
    delete ret['_id'];
    return ret;
  },
});

householdSchema.set('toObject', {
  transform: (_doc: any, ret: any) => {
    decryptAddress(ret);
    ret['id'] = ret['_id'];
    delete ret['_id'];
    return ret;
  },
});

export const Household = mongoose.model<IHouseholdDocument>('Household', householdSchema);
