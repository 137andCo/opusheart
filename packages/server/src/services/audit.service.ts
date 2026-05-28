import { AuditLog } from '../models/AuditLog.js';
import { sha256 } from '@opusheart/shared';
import { getRequestContext } from '../middleware/requestContext.js';

interface AuditEntry {
  action: string;
  actorEmail: string;
  actorRole: string;
  target: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

// Adaptive batching: collect entries and flush periodically or when batch is full
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 5000;

let batch: AuditEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushBatch(): Promise<void> {
  if (batch.length === 0) return;
  const entries = batch.splice(0);

  const docs = entries.map(entry => ({
    action: entry.action,
    actorHash: sha256(entry.actorEmail),
    actorRole: entry.actorRole,
    target: entry.target,
    targetId: entry.targetId,
    metadata: entry.metadata,
    requestId: getRequestContext()?.requestId,
    ip: entry.ip,
  }));

  try {
    await AuditLog.insertMany(docs, { ordered: false });
  } catch (err) {
    // Log but don't throw — audit should never break the request
    console.error('Audit log flush failed:', err);
  }
}

function scheduleBatchFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushBatch();
  }, FLUSH_INTERVAL_MS);
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  batch.push(entry);
  if (batch.length >= BATCH_SIZE) {
    await flushBatch();
  } else {
    scheduleBatchFlush();
  }
}

// Force flush — call on graceful shutdown
export async function flushAuditLog(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushBatch();
}

// For testing
export function getAuditBatchSize(): number {
  return batch.length;
}

export function clearAuditBatch(): void {
  batch = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
