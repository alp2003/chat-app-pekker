import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { loggerFactory, RequestSummary } from '../logger/logger.factory';
import { RequestWithContext } from '../middleware/request-context.middleware';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const response = context.switchToHttp().getResponse();
    
    const logger = loggerFactory.createLogger({
      requestId: request.requestId,
      correlationId: request.correlationId,
      userId: (request as any).user?.sub, // From JWT payload if available
    });

    const startTime = Date.now();
    
    // Log request start (no PII)
    const requestSummary: Partial<RequestSummary> = {
      method: request.method,
      url: this.sanitizeUrl(request.url),
      userAgent: request.headers['user-agent']?.substring(0, 100), // Truncate
      requestSize: request.headers['content-length'] ? 
        parseInt(request.headers['content-length'] as string, 10) : undefined,
    };

    logger.info({
      type: 'request_start',
      request: requestSummary,
    }, 'Request started');

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Log successful response
          const responseTime = Date.now() - startTime;
          const completeSummary: RequestSummary = {
            ...requestSummary as RequestSummary,
            statusCode: response.statusCode,
            responseTime,
            responseSize: response.getHeader('content-length') ? 
              parseInt(response.getHeader('content-length') as string, 10) : 
              (data ? JSON.stringify(data).length : undefined),
          };

          logger.info({
            type: 'request_success',
            request: completeSummary,
          }, `Request completed successfully in ${responseTime}ms`);
        },
        error: (error) => {
          // Log error response
          const responseTime = Date.now() - startTime;
          const errorSummary: RequestSummary = {
            ...requestSummary as RequestSummary,
            statusCode: error.status || 500,
            responseTime,
          };

          logger.error({
            type: 'request_error',
            request: errorSummary,
            error: {
              name: error.name,
              message: error.message,
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
          }, `Request failed after ${responseTime}ms`);
        },
      }),
    );
  }

  private sanitizeUrl(url: string): string {
    // Remove query parameters that might contain sensitive data
    const [path, queryString] = url.split('?', 2);
    if (!queryString) return path || '';
    
    const params = new URLSearchParams(queryString);
    const sanitizedParams = new URLSearchParams();
    
    // Only keep safe query parameters
    const safeParams = ['page', 'limit', 'sort', 'order', 'q'];
    safeParams.forEach(param => {
      if (params.has(param)) {
        sanitizedParams.set(param, params.get(param)!);
      }
    });
    
    return sanitizedParams.toString() ? 
      `${path || ''}?${sanitizedParams.toString()}` : (path || '');
  }
}
