import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CacheInterceptor } from './cache.interceptor';
import { CacheHelper } from './cache-helper';
import { of } from 'rxjs';

describe('CacheInterceptor', () => {
  let interceptor: CacheInterceptor;
  let cacheHelper: CacheHelper;
  let reflector: Reflector;

  const mockRequest = {
    method: 'GET',
    path: '/conversations',
    query: {},
    user: { id: 'user-123' },
  };

  const mockResponse = {
    setHeader: jest.fn(),
  };

  const mockExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
    getHandler: () => jest.fn(),
  } as unknown as ExecutionContext;

  const mockCallHandler = {
    handle: () => of({ data: 'test' }),
  } as CallHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInterceptor,
        {
          provide: CacheHelper,
          useValue: {
            checkRateLimit: jest.fn(),
            readThrough: jest.fn(),
            isCachingEnabled: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<CacheInterceptor>(CacheInterceptor);
    cacheHelper = module.get<CacheHelper>(CacheHelper);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      (reflector.get as jest.Mock).mockImplementation((key) => {
        if (key === 'rate_limit') {
          return {
            keyExtractor: (req: any) => `user:${req.user.id}`,
            window: 60,
            limit: 5,
          };
        }
        return undefined;
      });
    });

    it('should allow request when under rate limit', async () => {
      (cacheHelper.checkRateLimit as jest.Mock).mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 60000,
      });

      const result = await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();

      expect(result).toEqual({ data: 'test' });
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
    });

    it('should deny request when rate limit exceeded', async () => {
      (cacheHelper.checkRateLimit as jest.Mock).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
      });

      await expect(
        interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise()
      ).rejects.toThrow(HttpException);

      try {
        await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('should extract user ID for rate limiting', async () => {
      (cacheHelper.checkRateLimit as jest.Mock).mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 60000,
      });

      await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();

      expect(cacheHelper.checkRateLimit).toHaveBeenCalledWith(
        'user:user-123',
        { window: 60, limit: 5 }
      );
    });
  });

  describe('caching', () => {
    beforeEach(() => {
      (reflector.get as jest.Mock).mockImplementation((key) => {
        if (key === 'cache') {
          return {
            key: 'conversations:user::userId',
            ttl: 60,
            jitter: 10,
          };
        }
        return undefined;
      });
    });

    it('should cache GET requests when caching is enabled', async () => {
      (cacheHelper.readThrough as jest.Mock).mockResolvedValue({ data: 'cached' });

      const result = await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();

      expect(result).toEqual({ data: 'cached' });
      expect(cacheHelper.readThrough).toHaveBeenCalledWith(
        'conversations:user:user-123',
        expect.any(Function),
        { ttl: 60, jitter: 10 }
      );
    });

    it('should not cache when caching is disabled', async () => {
      (cacheHelper.isCachingEnabled as jest.Mock).mockReturnValue(false);

      const result = await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();

      expect(result).toEqual({ data: 'test' });
      expect(cacheHelper.readThrough).not.toHaveBeenCalled();
    });

    it('should not cache non-GET requests', async () => {
      const postRequest = { ...mockRequest, method: 'POST' };
      const postContext = {
        switchToHttp: () => ({
          getRequest: () => postRequest,
          getResponse: () => mockResponse,
        }),
        getHandler: () => jest.fn(),
      } as unknown as ExecutionContext;

      const result = await interceptor.intercept(postContext, mockCallHandler).toPromise();

      expect(result).toEqual({ data: 'test' });
      expect(cacheHelper.readThrough).not.toHaveBeenCalled();
    });

    it('should build cache key with user ID replacement', async () => {
      (cacheHelper.readThrough as jest.Mock).mockResolvedValue({ data: 'cached' });

      await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();

      expect(cacheHelper.readThrough).toHaveBeenCalledWith(
        'conversations:user:user-123',
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should include query parameters in cache key', async () => {
      const requestWithQuery = {
        ...mockRequest,
        query: { roomId: 'room-456', limit: '10' },
      };
      
      const contextWithQuery = {
        switchToHttp: () => ({
          getRequest: () => requestWithQuery,
          getResponse: () => mockResponse,
        }),
        getHandler: () => jest.fn(),
      } as unknown as ExecutionContext;

      (cacheHelper.readThrough as jest.Mock).mockResolvedValue({ data: 'cached' });

      await interceptor.intercept(contextWithQuery, mockCallHandler).toPromise();

      expect(cacheHelper.readThrough).toHaveBeenCalledWith(
        expect.stringContaining('roomId=room-456&limit=10'),
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  describe('combined rate limiting and caching', () => {
    beforeEach(() => {
      (reflector.get as jest.Mock).mockImplementation((key) => {
        if (key === 'rate_limit') {
          return {
            keyExtractor: (req: any) => `user:${req.user.id}`,
            window: 60,
            limit: 5,
          };
        }
        if (key === 'cache') {
          return {
            key: 'conversations:user::userId',
            ttl: 60,
            jitter: 10,
          };
        }
        return undefined;
      });
    });

    it('should apply rate limiting before caching', async () => {
      (cacheHelper.checkRateLimit as jest.Mock).mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 60000,
      });
      (cacheHelper.readThrough as jest.Mock).mockResolvedValue({ data: 'cached' });

      const result = await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();

      expect(result).toEqual({ data: 'cached' });
      expect(cacheHelper.checkRateLimit).toHaveBeenCalled();
      expect(cacheHelper.readThrough).toHaveBeenCalled();
    });

    it('should not cache when rate limited', async () => {
      (cacheHelper.checkRateLimit as jest.Mock).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
      });

      await expect(
        interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise()
      ).rejects.toThrow(HttpException);

      expect(cacheHelper.readThrough).not.toHaveBeenCalled();
    });
  });

  describe('without decorators', () => {
    beforeEach(() => {
      (reflector.get as jest.Mock).mockReturnValue(undefined);
    });

    it('should pass through without rate limiting or caching', async () => {
      const result = await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();

      expect(result).toEqual({ data: 'test' });
      expect(cacheHelper.checkRateLimit).not.toHaveBeenCalled();
      expect(cacheHelper.readThrough).not.toHaveBeenCalled();
    });
  });
});
