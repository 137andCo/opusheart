import type { Request } from 'express';
import { User } from '../models/User.js';
import { logAudit } from './audit.service.js';

/**
 * Emit an audit entry for an authenticated request. Resolves the actor's email
 * (for pseudonymized hashing in the audit log) from the authenticated user id.
 * Fire-and-forget: auditing must never break or slow the request meaningfully,
 * and failures are swallowed inside logAudit/flush.
 */
export async function audit(
  req: Request,
  entry: { action: string; target: string; targetId?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  let actorEmail = 'unknown';
  const role = req.user?.role ?? 'anonymous';
  try {
    if (req.user?.id) {
      const user = await User.findById(req.user.id).select('email').lean();
      // email is stored encrypted; for a stable pseudonymous actor id we hash
      // the stored value as-is (the raw email never lands in the log either way).
      if (user?.email) actorEmail = user.email;
    }
  } catch {
    // ignore — fall back to 'unknown'
  }

  await logAudit({
    action: entry.action,
    actorEmail,
    actorRole: role,
    target: entry.target,
    targetId: entry.targetId,
    metadata: entry.metadata,
    ip: req.ip,
  });
}

/** Audit a known actor email (e.g. login/register, where req.user isn't set yet). */
export async function auditByEmail(
  email: string,
  role: string,
  ip: string | undefined,
  entry: { action: string; target: string; targetId?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  await logAudit({
    action: entry.action,
    actorEmail: email,
    actorRole: role,
    target: entry.target,
    targetId: entry.targetId,
    metadata: entry.metadata,
    ip,
  });
}
