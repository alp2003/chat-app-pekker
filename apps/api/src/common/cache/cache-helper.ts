import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { loggerFactory } from '../logger/logger.factory';

export interface CacheOptions {
  ttl: number; // seconds
  jitter?: number; // percentage (0-100)
}

export interface RateLimitOptions {
  window: number; // seconds
  limit: number;
}

@Injectable()
export class CacheHelper {
  private readonly redis: Redis;
  private readonly logger = loggerFactory.createLogger({
    service: 'CacheHelper',
  });

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      lazyConnect: true,
    });

    this.redis.on('error', (err: Error) => {
      this.logger.error({ error: err.message }, 'Redis connection error');
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
    });
  }

  /**
   * Read-through cache helper with TTL and jitter
   */
  async readThrough<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions,
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.redis.get(key);
      if (cached) {
        this.logger.debug({ key }, 'Cache hit');
        return JSON.parse(cached);
      }

      this.logger.debug({ key }, 'Cache miss');
      // Fetch fresh data
      const data = await fetchFn();

      // Calculate TTL with jitter
      const jitter = options.jitter || 0;
      const jitterRange = (options.ttl * jitter) / 100;
      const actualTtl =
        options.ttl + Math.random() * jitterRange - jitterRange / 2;

      // Store in cache
      await this.redis.setex(key, Math.floor(actualTtl), JSON.stringify(data));

      return data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        {
          key,
          error: errorMessage,
        },
        'Cache operation failed, falling back to direct fetch',
      );
      // Fallback to direct fetch if cache fails
      return fetchFn();
    }
  }

  /**
   * Rate limiting with sliding window
   */
  async checkRateLimit(
    key: string,
    options: RateLimitOptions,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const now = Date.now();
      const window = options.window * 1000; // convert to ms
      const windowStart = now - window;

      // Clean old entries and count current requests
      const pipe = this.redis.pipeline();
      pipe.zremrangebyscore(key, 0, windowStart);
      pipe.zcard(key);
      pipe.expire(key, options.window);

      const results = await pipe.exec();
      const currentCount = (results?.[1]?.[1] as number) || 0;

      if (currentCount >= options.limit) {
        // Get the oldest entry to calculate reset time
        const oldestEntries = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
        const resetTime =
          oldestEntries.length > 0 && oldestEntries[1]
            ? parseInt(oldestEntries[1]) + window
            : now + window;

        return {
          allowed: false,
          remaining: 0,
          resetTime,
        };
      }

      // Add current request
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);

      return {
        allowed: true,
        remaining: options.limit - currentCount - 1,
        resetTime: now + window,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        {
          key,
          error: errorMessage,
        },
        'Rate limit check failed, allowing request',
      );
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: options.limit - 1,
        resetTime: Date.now() + options.window * 1000,
      };
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(
          { pattern, keysCount: keys.length },
          'Cache invalidated',
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        {
          pattern,
          error: errorMessage,
        },
        'Cache invalidation failed',
      );
    }
  }

  /**
   * Check if caching is enabled via feature flag
   */
  isCachingEnabled(): boolean {
    return this.configService.get('CACHE_TICKETS', '0') === '1';
  }

  /**
   * Get Redis client for custom operations
   */
  getClient(): Redis {
    return this.redis;
  }

  async onModuleDestroy() {
    await this.redis.disconnect();
  }
}
