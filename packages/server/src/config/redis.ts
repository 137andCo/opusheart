import { Redis } from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'redis' });

let redisClient: Redis | null = null;

export function createRedisClient(url: string): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    },
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err: Error) => logger.error(err, 'Redis error'));

  redisClient = client;
  return client;
}

export function getRedisClient(): Redis {
  if (!redisClient) throw new Error('Redis not initialized');
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
