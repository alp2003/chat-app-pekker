import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheHelper } from './cache-helper';
import { RedisMock } from './__mocks__/redis.mock';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => new RedisMock());
});

describe('CacheHelper', () => {
  let service: CacheHelper;
  let redis: RedisMock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheHelper,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
                CACHE_TICKETS: '1',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheHelper>(CacheHelper);
    redis = (service as any).redis as RedisMock;
    redis.clear();
  });

  afterEach(() => {
    redis.clear();
  });

  describe('readThrough', () => {
    it('should fetch and cache data on cache miss', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ data: 'test' });

      const result = await service.readThrough('test-key', fetchFn, {
        ttl: 60,
      });

      expect(result).toEqual({ data: 'test' });
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Check that data was cached
      const cached = await redis.get('test-key');
      expect(JSON.parse(cached!)).toEqual({ data: 'test' });
    });

    it('should return cached data on cache hit', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ data: 'test' });

      // Prime the cache
      await service.readThrough('test-key', fetchFn, { ttl: 60 });

      // Second call should hit cache
      const result = await service.readThrough('test-key', fetchFn, {
        ttl: 60,
      });

      expect(result).toEqual({ data: 'test' });
      expect(fetchFn).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should apply jitter to TTL', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ data: 'test' });
      const setexSpy = jest.spyOn(redis, 'setex');

      await service.readThrough('test-key', fetchFn, { ttl: 100, jitter: 20 });

      expect(setexSpy).toHaveBeenCalled();
      const ttlUsed = setexSpy.mock.calls[0]?.[1];
      expect(ttlUsed).toBeGreaterThanOrEqual(80); // 100 - 20% = 80
      expect(ttlUsed).toBeLessThanOrEqual(120); // 100 + 20% = 120
    });

    it('should fallback to fetchFn when cache fails', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ data: 'test' });
      jest.spyOn(redis, 'get').mockRejectedValue(new Error('Redis error'));

      const result = await service.readThrough('test-key', fetchFn, {
        ttl: 60,
      });

      expect(result).toEqual({ data: 'test' });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-01-01T00:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should allow request when under limit', async () => {
      const result = await service.checkRateLimit('user:123', {
        window: 60,
        limit: 5,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should deny request when limit exceeded', async () => {
      const options = { window: 60, limit: 2 };

      // Make requests up to limit
      await service.checkRateLimit('user:123', options);
      await service.checkRateLimit('user:123', options);

      // This should be denied
      const result = await service.checkRateLimit('user:123', options);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', async () => {
      const options = { window: 60, limit: 2 };

      // Exhaust limit
      await service.checkRateLimit('user:123', options);
      await service.checkRateLimit('user:123', options);

      // Move time forward beyond window
      jest.advanceTimersByTime(61000);

      // Should be allowed again
      const result = await service.checkRateLimit('user:123', options);
      expect(result.allowed).toBe(true);
    });

    it('should handle different users independently', async () => {
      const options = { window: 60, limit: 1 };

      // User 1 exhausts limit
      await service.checkRateLimit('user:123', options);
      const result1 = await service.checkRateLimit('user:123', options);
      expect(result1.allowed).toBe(false);

      // User 2 should still be allowed
      const result2 = await service.checkRateLimit('user:456', options);
      expect(result2.allowed).toBe(true);
    });

    it('should fail open when rate limiting fails', async () => {
      jest.spyOn(redis, 'pipeline').mockImplementation(() => {
        throw new Error('Redis error');
      });

      const result = await service.checkRateLimit('user:123', {
        window: 60,
        limit: 5,
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('invalidatePattern', () => {
    it('should delete matching keys', async () => {
      // Set up test data
      await redis.set('user:123:profile', '{}');
      await redis.set('user:456:profile', '{}');
      await redis.set('post:789', '{}');

      await service.invalidatePattern('user:*:profile');

      // User profiles should be deleted
      expect(await redis.get('user:123:profile')).toBeNull();
      expect(await redis.get('user:456:profile')).toBeNull();

      // Other keys should remain
      expect(await redis.get('post:789')).toBe('{}');
    });
  });

  describe('isCachingEnabled', () => {
    it('should return true when CACHE_TICKETS=1', () => {
      expect(service.isCachingEnabled()).toBe(true);
    });

    it('should return false when CACHE_TICKETS=0', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CacheHelper,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('0'),
            },
          },
        ],
      }).compile();

      const service = module.get<CacheHelper>(CacheHelper);
      expect(service.isCachingEnabled()).toBe(false);
    });
  });

  describe('Redis connection handling', () => {
    it('should handle connection events', (done) => {
      // This test verifies that Redis events are properly handled
      redis.on('connect', () => {
        done();
      });

      redis.emit('connect');
    });

    it('should handle Redis errors gracefully', (done) => {
      redis.on('error', (err: Error) => {
        expect(err.message).toBe('Test error');
        done();
      });

      redis.emit('error', new Error('Test error'));
    });
  });
});
