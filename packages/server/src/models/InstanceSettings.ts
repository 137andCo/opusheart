import mongoose, { Schema, Document } from 'mongoose';
import { encrypt, decrypt } from '@opusheart/shared';

export interface IInstanceSettings {
  instanceName: string;
  instanceUrl: string;
  vertical: string;
  locale: string;
  timezone: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
    faviconUrl?: string;
    customCss?: string;
  };
  federationPublicKey?: string;
  /** Ed25519 secret key, AES-256-GCM encrypted at rest (see pre-save hook). */
  federationPrivateKey?: string;
}

export interface IInstanceSettingsDocument extends IInstanceSettings, Document {}

const instanceSettingsSchema = new Schema<IInstanceSettingsDocument>(
  {
    instanceName: { type: String, required: true },
    instanceUrl: { type: String, required: true },
    vertical: { type: String, default: 'church' },
    locale: { type: String, default: 'en' },
    timezone: { type: String, default: 'America/New_York' },
    branding: {
      primaryColor: { type: String, default: '#1e40af' },
      secondaryColor: { type: String, default: '#f59e0b' },
      logoUrl: { type: String },
      faviconUrl: { type: String },
      customCss: { type: String },
    },
    federationPublicKey: { type: String },
    federationPrivateKey: { type: String },
  },
  { timestamps: true }
);

const getKey = (): string => {
  const key = process.env['ENCRYPTION_KEY'];
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  return key;
};

// The federation private key is a long-lived signing secret — encrypt it at rest
// so a DB dump alone cannot impersonate this instance on the mesh.
instanceSettingsSchema.pre('save', function () {
  if (this.federationPrivateKey && this.isModified('federationPrivateKey')) {
    this.federationPrivateKey = encrypt(this.federationPrivateKey, getKey());
  }
});

/** Decrypt and return the stored Ed25519 secret key, or null if none set. */
instanceSettingsSchema.methods['getDecryptedPrivateKey'] = function (): string | null {
  if (!this['federationPrivateKey']) return null;
  try {
    return decrypt(this['federationPrivateKey'], getKey());
  } catch {
    return null;
  }
};

export const InstanceSettings = mongoose.model<IInstanceSettingsDocument>('InstanceSettings', instanceSettingsSchema);
