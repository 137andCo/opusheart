import mongoose, { Schema, Document } from 'mongoose';
import { encryptionPlugin } from './plugins/encryption.plugin.js';

export interface IUser {
  email: string;
  emailHash: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  phoneHash?: string;
  role: 'admin' | 'pastor' | 'leader' | 'member' | 'visitor';
  mfaEnabled: boolean;
  mfaSecret?: string;
  /** Last TOTP timestep consumed at login — blocks in-window replay of a code. */
  mfaLastUsedStep?: number;
  /** When the pending (unconfirmed) MFA enrollment began — enforces an enroll TTL. */
  mfaEnrollStartedAt?: Date;
  /** Consecutive failed login attempts (password or MFA) since last success. */
  failedLoginAttempts: number;
  /** If set and in the future, login is refused regardless of credentials. */
  lockedUntil?: Date;
  avatar?: string;
  locale: string;
  timezone: string;
  privacySettings: {
    showInDirectory: boolean;
    showEmail: boolean;
    showPhone: boolean;
    allowCareTracking: boolean;
  };
  pushSubscription?: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  active: boolean;
  lastLoginAt?: Date;
  tokenInvalidatedAt?: Date;
}

export interface IUserDocument extends IUser, Document {}

const userSchema = new Schema<IUserDocument>(
  {
    email: { type: String, required: true },
    emailHash: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    phoneHash: { type: String, index: true, sparse: true },
    role: {
      type: String,
      enum: ['admin', 'pastor', 'leader', 'member', 'visitor'],
      default: 'visitor',
    },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String },
    mfaLastUsedStep: { type: Number },
    mfaEnrollStartedAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    avatar: { type: String },
    locale: { type: String, default: 'en' },
    timezone: { type: String, default: 'America/New_York' },
    privacySettings: {
      showInDirectory: { type: Boolean, default: false },
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      allowCareTracking: { type: Boolean, default: false },
    },
    pushSubscription: { type: Schema.Types.Mixed },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    tokenInvalidatedAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.plugin(encryptionPlugin, {
  fields: ['email', 'firstName', 'lastName', 'phone', 'mfaSecret'],
  hashFields: ['email', 'phone'],
});

export const User = mongoose.model<IUserDocument>('User', userSchema);
