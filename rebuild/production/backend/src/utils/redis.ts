import Redis from 'ioredis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`Redis error: ${errorMessage}`, {
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
  });
});

export default redis;

