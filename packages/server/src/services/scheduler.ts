import pino from 'pino';
import { Message } from '../models/Message.js';
import { messageService } from './message.service.js';
import { getRedisClient } from '../config/redis.js';

const logger = pino({ name: 'opusheart:scheduler' });

const TICK_MS = 60_000;          // check for due messages once a minute
const LOCK_KEY = 'scheduler:messages:lock';
const LOCK_TTL_SEC = 50;         // < TICK_MS so the lock frees before the next tick

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Acquire a short-lived Redis lock so that, across multiple server replicas,
 * only ONE runs the sweep per tick (otherwise every replica would send each
 * scheduled message). Best-effort: if Redis is unavailable we skip the tick
 * rather than risk double-sending.
 */
async function acquireLock(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const res = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SEC, 'NX');
    return res === 'OK';
  } catch {
    return false;
  }
}

/** Send any scheduled messages whose time has arrived. */
export async function runDueMessages(now: Date = new Date()): Promise<number> {
  const due = await Message.find({ status: 'scheduled', scheduledFor: { $lte: now } })
    .select('_id')
    .limit(100);
  let sent = 0;
  for (const m of due) {
    try {
      await messageService.send(m._id.toString());
      sent++;
    } catch (err) {
      logger.error({ err, messageId: m._id.toString() }, 'Scheduled message send failed');
    }
  }
  return sent;
}

export function startScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    void (async () => {
      if (!(await acquireLock())) return; // another replica owns this tick
      try {
        const sent = await runDueMessages();
        if (sent > 0) logger.info('Scheduler dispatched %d scheduled message(s)', sent);
      } catch (err) {
        logger.error({ err }, 'Scheduler tick failed');
      }
    })();
  }, TICK_MS);
  timer.unref(); // don't keep the process alive solely for the scheduler
  logger.info('Scheduled-message sweeper started (every %ds)', TICK_MS / 1000);
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
