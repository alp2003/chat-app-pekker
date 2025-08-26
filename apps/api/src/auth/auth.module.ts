import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { PrismaService } from 'src/prisma.service';
import { JwtHttpGuard } from './jwt-http.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          expiresIn: cfg.get<string>('JWT_ACCESS_EXPIRES') ?? '1h', // 1 hour for testing to eliminate race conditions

          // issuer: cfg.get<string>('JWT_ISSUER') ?? undefined,
          // audience: cfg.get<string>('JWT_AUDIENCE') ?? undefined,
          // algorithm: 'HS256', // default; set explicitly if you want
        },
      }),
    }),
  ],
  providers: [AuthService, PrismaService, JwtHttpGuard],
  exports: [AuthService, JwtHttpGuard],
  controllers: [AuthController],
})
export class AuthModule {}
