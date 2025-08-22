import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { CacheHelper } from './cache-helper';
import {
  CACHE_KEY,
  RATE_LIMIT_KEY,
  CacheMetadata,
  RateLimitMetadata,
} from './cache.decorators';
import { loggerFactory } from '../logger/logger.factory';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = loggerFactory.createLogger({
    service: 'CacheInterceptor',
  });

  constructor(
    private readonly cacheHelper: CacheHelper,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get metadata from decorators
    const cacheMetadata = this.reflector.get<CacheMetadata>(
      CACHE_KEY,
      context.getHandler(),
    );
    const rateLimitMetadata = this.reflector.get<RateLimitMetadata>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    return from(
      this.handleRequest(
        context,
        next,
        request,
        response,
        cacheMetadata,
        rateLimitMetadata,
      ),
    );
  }

  private async handleRequest(
    context: ExecutionContext,
    next: CallHandler,
    request: Request,
    response: Response,
    cacheMetadata?: CacheMetadata,
    rateLimitMetadata?: RateLimitMetadata,
  ): Promise<any> {
    try {
      // Handle rate limiting first
      if (rateLimitMetadata) {
        await this.handleRateLimit(request, response, rateLimitMetadata);
      }

      // Handle caching for GET requests
      if (
        cacheMetadata &&
        request.method === 'GET' &&
        this.cacheHelper.isCachingEnabled()
      ) {
        return await this.handleCache(context, next, request, cacheMetadata);
      }

      // Execute the handler normally
      return await next.handle().toPromise();
    } catch (error) {
      throw error;
    }
  }

  private async handleRateLimit(
    request: Request,
    response: Response,
    metadata: RateLimitMetadata,
  ): Promise<void> {
    const key = metadata.keyExtractor(request);
    const result = await this.cacheHelper.checkRateLimit(key, {
      window: metadata.window,
      limit: metadata.limit,
    });

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', metadata.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      this.logger.warn(
        {
          key,
          limit: metadata.limit,
          window: metadata.window,
        },
        'Rate limit exceeded',
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async handleCache(
    context: ExecutionContext,
    next: CallHandler,
    request: Request,
    metadata: CacheMetadata,
  ): Promise<any> {
    const cacheKey = this.buildCacheKey(request, metadata.key);

    return await this.cacheHelper.readThrough(
      cacheKey,
      async () => {
        const result = await next.handle().toPromise();
        return result;
      },
      {
        ttl: metadata.ttl,
        jitter: metadata.jitter,
      },
    );
  }

  private buildCacheKey(
    request: Request & { user?: { id: string } },
    keyTemplate: string,
  ): string {
    let key = keyTemplate;

    // Replace common placeholders
    key = key.replace(':userId', request.user?.id || 'anonymous');
    key = key.replace(':path', request.path);
    key = key.replace(':method', request.method);

    // Replace query parameters
    const queryString = new URLSearchParams(
      request.query as Record<string, string>,
    ).toString();
    if (queryString) {
      key = `${key}?${queryString}`;
    }

    return key;
  }
}
