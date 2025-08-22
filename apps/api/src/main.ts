// Initialize tracing before any other imports
import './common/tracing/tracing';
import { initializeTracing } from './common/tracing/tracing';

// Initialize tracing as early as possible
initializeTracing();

import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { loggerFactory } from './common/logger/logger.factory';

async function bootstrap() {
  const logger = loggerFactory.getBaseLogger();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: false, // Disable default NestJS logger
  });

  const configService = app.get(ConfigService);
  app.use(cookieParser());
  app.enableCors({ origin: [/^http:\/\/localhost:\d+$/], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const redisUrl = configService.get<string>('app.redisUrl');
  if (redisUrl) {
    const pubClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
        connectTimeout: 10000,
      },
    });
    const subClient = pubClient.duplicate();
    await pubClient.connect();
    await subClient.connect();

    const ioAdapter = new IoAdapter(app);
    // Override createIOServer to add Redis adapter - requires type assertion due to Socket.IO adapter API
    (ioAdapter as any).createIOServer = function (
      port: number,
      options?: ServerOptions,
    ): any {
      const server = (
        (IoAdapter.prototype as any).createIOServer as Function
      ).call(this, port, {
        ...options,
        cors: { origin: [/^http:\/\/localhost:\d+$/], credentials: true },
      });
      (server.adapter as Function)(createAdapter(pubClient, subClient));
      return server;
    };
    app.useWebSocketAdapter(ioAdapter);
  }

  const port = configService.get<number>('app.port');
  await app.listen(Number(port));

  logger.info(
    {
      type: 'server_start',
      port,
      redisUrl: redisUrl ? 'configured' : 'not_configured',
      environment: process.env.NODE_ENV,
    },
    `Server started on port ${port}`,
  );
}

void bootstrap();
