import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog {
  action: string;
  actorHash: string;         // SHA-256 of actor email (pseudonymized)
  actorRole: string;
  target: string;            // what was acted on
  targetId?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  ip?: string;
}

export interface IAuditLogDocument extends IAuditLog, Document {}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    action: { type: String, required: true, index: true },
    actorHash: { type: String, required: true, index: true },
    actorRole: { type: String, required: true },
    target: { type: String, required: true },
    targetId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed },
    requestId: { type: String },
    ip: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    // Append-only: no updates
  }
);

// TTL index for configurable retention (default 2 years)
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 63072000 }
);

export const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', auditLogSchema);
