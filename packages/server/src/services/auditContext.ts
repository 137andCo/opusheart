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
  let actorHash: string | undefined;
  const role = req.user?.role ?? 'anonymous';
  try {
    if (req.user?.id) {
      // emailHash is already the keyed blind index of the email — use it directly
      // as the actor id. (Reading the encrypted `email` via .lean() yields
      // ciphertext, producing a hash that can't correlate with login events.)
      const user = await User.findById(req.user.id).select('emailHash').lean();
      if (user?.emailHash) actorHash = user.emailHash;
    }
  } catch {
    // ignore — fall back to 'unknown' (actorHash stays undefined)
  }

  await logAudit({
    action: entry.action,
    actorHash,
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
