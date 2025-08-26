import appConfig from './config/app.config';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import * as Joi from 'joi';
import { UsersModule } from './users/users.module';
import { CacheService } from './common/cache.service';
import { HealthController } from './health/health.controller';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CacheModule } from './common/cache/cache.module';
import { CacheInterceptor } from './common/cache/cache.interceptor';
import { DebugModule } from './debug/debug.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [
        '../../.env', // monorepo root
        '.env', // apps/api local fallback
      ],
      validationSchema: Joi.object({
        JWT_ACCESS_SECRET: Joi.string().min(16).required(),
        JWT_ACCESS_EXPIRES: Joi.string().default('1h'),
        JWT_REFRESH_SECRET: Joi.string().min(16).required(),
        JWT_REFRESH_EXPIRES: Joi.string().default('30d'),
        JWT_ISSUER: Joi.string().optional(),
        JWT_AUDIENCE: Joi.string().optional(),
        
        // Cache TTL configuration (in seconds)
        CACHE_DEFAULT_TTL: Joi.number().integer().min(60).default(900),
        CACHE_USER_TTL: Joi.number().integer().min(60).default(1800),
        CACHE_CONVERSATIONS_TTL: Joi.number().integer().min(60).default(900),
        CACHE_MESSAGES_TTL: Joi.number().integer().min(60).default(600),
        CACHE_SESSION_TTL: Joi.number().integer().min(60).default(3300),
      }),
      expandVariables: true,
      load: [appConfig],
    }),
    AuthModule,
    ChatModule,
    UsersModule,
    CacheModule,
    ...(process.env.NODE_ENV !== 'production' ? [DebugModule] : []),
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    CacheService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
