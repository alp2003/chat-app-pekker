import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// Metadata keys for decorators
export const CACHE_KEY = 'cache';
export const RATE_LIMIT_KEY = 'rate_limit';

// Cache decorator metadata
export interface CacheMetadata {
  key: string;
  ttl: number;
  jitter?: number;
}

// Rate limit decorator metadata
export interface RateLimitMetadata {
  keyExtractor: (req: Request) => string;
  window: number;
  limit: number;
}

/**
 * Cache decorator for controller methods
 * @param key Cache key (can include placeholders like :userId)
 * @param ttl TTL in seconds
 * @param jitter Jitter percentage (0-100)
 */
export const Cache = (key: string, ttl: number, jitter?: number) =>
  SetMetadata(CACHE_KEY, { key, ttl, jitter } as CacheMetadata);

/**
 * Rate limit decorator for controller methods
 * @param keyExtractor Function to extract key from request
 * @param window Window size in seconds
 * @param limit Maximum requests per window
 */
export const RateLimit = (
  keyExtractor: (req: Request) => string,
  window: number,
  limit: number,
) =>
  SetMetadata(RATE_LIMIT_KEY, { keyExtractor, window, limit } as RateLimitMetadata);

/**
 * Convenience decorators for common rate limiting patterns
 */
export const RateLimitByUser = (window: number, limit: number) =>
  RateLimit((req: Request & { user?: { id: string } }) => {
    const user = req.user;
    return `rate_limit:user:${user?.id || 'anonymous'}`;
  }, window, limit);

export const RateLimitByIP = (window: number, limit: number) =>
  RateLimit((req: Request) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `rate_limit:ip:${ip}`;
  }, window, limit);

/**
 * Parameter decorator to extract user ID from request
 */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.id;
  },
);
