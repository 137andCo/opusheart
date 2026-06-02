import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { loadConfig } from './config/index.js';
import { connectDatabase } from './config/database.js';
import { createRedisClient } from './config/redis.js';
import { createApp } from './app.js';
import { flushAuditLog } from './services/audit.service.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';
import { searchService } from './services/search.service.js';
import { aiManager } from '@opusheart/ai';
import pino from 'pino';

const logger = pino({ name: 'opusheart' });

// Global error handlers — prevent silent crashes
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  const config = loadConfig();

  await connectDatabase(config.mongo.uri);
  createRedisClient(config.redis.url);

  // Optional Elasticsearch search: build/refresh the index from Mongo on boot.
  // Best-effort and non-blocking — a search outage never stops the server, and
  // search falls back to MongoDB when ES is unset or unreachable.
  if (searchService.enabled()) {
    searchService.reindexAll()
      .then((n) => logger.info('Search index ready (%d resources indexed)', n))
      .catch((err) => logger.warn({ err }, 'Search reindex failed — using MongoDB fallback'));
  }

  if (config.features.ai && process.env['AI_PROVIDER'] && process.env['AI_API_KEY']) {
    aiManager.configure({
      provider: process.env['AI_PROVIDER'],
      baseUrl: process.env['AI_BASE_URL'],
      apiKey: process.env['AI_API_KEY'],
      model: process.env['AI_MODEL'] || 'gpt-4o-mini',
    });
    logger.info('AI configured: provider=%s model=%s', process.env['AI_PROVIDER'], process.env['AI_MODEL'] || 'gpt-4o-mini');
  }

  const app = createApp(config);

  const server = app.listen(config.port, () => {
    logger.info('OpusHeart server listening on port %d (%s)', config.port, config.nodeEnv);
    logger.info('Instance: %s — Vertical: %s', config.instance.name, config.vertical);
  });

  // Dispatch scheduled messages whose time has come (Redis-locked across replicas).
  startScheduler();

  // Graceful shutdown — flush any buffered audit entries before exit
  const shutdown = async (signal: string): Promise<void> => {
    logger.info('%s received — flushing audit log and shutting down', signal);
    stopScheduler();
    await flushAuditLog();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error(err, 'Failed to start OpusHeart');
  process.exit(1);
});
