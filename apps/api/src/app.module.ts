import appConfig from './config/app.config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import * as Joi from 'joi';
import { UsersModule } from './users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { CacheService } from './common/cache.service';

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
      }),
      expandVariables: true,
      load: [appConfig],
    }),
    AuthModule,
    ChatModule,
    UsersModule,
  ],
  controllers: [],
  providers: [PrismaService, CacheService],
})
export class AppModule {}
