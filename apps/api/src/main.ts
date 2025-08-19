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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  app.use(cookieParser());
  app.enableCors({ origin: [/^http:\/\/localhost:\d+$/], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const redisUrl = configService.get<string>('app.redisUrl');
  if (redisUrl) {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    await pubClient.connect();
    await subClient.connect();

    const ioAdapter = new IoAdapter(app);
    (ioAdapter as any).createIOServer = function (
      port: number,
      options?: ServerOptions,
    ) {
      const server = (IoAdapter.prototype as any).createIOServer.call(
        this,
        port,
        {
          ...options,
          cors: { origin: [/^http:\/\/localhost:\d+$/], credentials: true },
        },
      );
      server.adapter(createAdapter(pubClient, subClient));
      return server;
    };
    app.useWebSocketAdapter(ioAdapter);
  }

  const port = configService.get<number>('app.port');
  await app.listen(Number(port));

  console.warn(`Port: ${port}`);
  console.warn(`Redis: ${redisUrl}`);
}

bootstrap();
