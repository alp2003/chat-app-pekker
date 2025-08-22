import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithContext extends Request {
  requestId: string;
  correlationId: string;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction) {
    // Generate or extract request ID
    req.requestId = (req.headers['x-request-id'] as string) || randomUUID();
    
    // Extract or generate correlation ID 
    req.correlationId = (req.headers['x-correlation-id'] as string) || req.requestId;

    // Set response headers for tracing
    res.setHeader('x-request-id', req.requestId);
    res.setHeader('x-correlation-id', req.correlationId);

    next();
  }
}
