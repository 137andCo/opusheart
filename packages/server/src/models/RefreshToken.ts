import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshToken {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;          // SHA-256 of the token
  jti: string;                // unique token ID for replay detection
  expiresAt: Date;
  invalidated: boolean;
}

export interface IRefreshTokenDocument extends IRefreshToken, Document {}

const refreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    jti: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    invalidated: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL to auto-cleanup expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshTokenDocument>('RefreshToken', refreshTokenSchema);
