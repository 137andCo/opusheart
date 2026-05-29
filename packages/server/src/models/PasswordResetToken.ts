import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPasswordResetToken {
  userId: Types.ObjectId;
  /** SHA-256 of the random token — the plaintext is only ever emailed, never stored. */
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
}

export interface IPasswordResetTokenDocument extends IPasswordResetToken, Document {}

const schema = new Schema<IPasswordResetTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

// TTL index: Mongo auto-purges expired tokens.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken = mongoose.model<IPasswordResetTokenDocument>('PasswordResetToken', schema);
