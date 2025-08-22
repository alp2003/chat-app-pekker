import { pino, Logger } from 'pino';
import { IncomingMessage } from 'http';

export interface LoggerContext {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  service?: string;
  version?: string;
}

export interface RequestSummary {
  method: string;
  url: string;
  userAgent?: string;
  statusCode?: number;
  responseTime?: number;
  requestSize?: number;
  responseSize?: number;
}

class LoggerFactory {
  private static instance: LoggerFactory;
  private baseLogger: Logger;

  private constructor() {
    this.baseLogger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
      base: {
        service: process.env.SERVICE_NAME || 'chat-api',
        version: process.env.SERVICE_VERSION || '0.0.1',
      },
    });
  }

  static getInstance(): LoggerFactory {
    if (!LoggerFactory.instance) {
      LoggerFactory.instance = new LoggerFactory();
    }
    return LoggerFactory.instance;
  }

  createLogger(context: LoggerContext = {}): Logger {
    return this.baseLogger.child({
      requestId: context.requestId,
      correlationId: context.correlationId,
      userId: context.userId,
      service: context.service,
      version: context.version,
    });
  }

  getBaseLogger(): Logger {
    return this.baseLogger;
  }
}

export const loggerFactory = LoggerFactory.getInstance();
