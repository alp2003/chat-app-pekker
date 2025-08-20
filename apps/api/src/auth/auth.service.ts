import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import * as argon2 from 'argon2';
import { add } from 'date-fns';

// Fast argon2 settings for development
const getArgonOptions = (isDev: boolean) => ({
  type: argon2.argon2id,
  memoryCost: isDev ? 2 ** 12 : 2 ** 16, // 4MB vs 64MB
  timeCost: isDev ? 2 : 3, // 2 vs 3 iterations
  parallelism: isDev ? 1 : 1, // 1 thread
});

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async register(input: {
    username: string;
    password: string;
    displayName?: string;
  }) {
    const username = input.username.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({
      where: { username: username },
    });
    if (exists) throw new BadRequestException('username_taken');
    const isDev = this.configService.get('NODE_ENV') !== 'production';
    const argonOpts = getArgonOptions(isDev);
    const passwordHash = await argon2.hash(input.password, argonOpts);
    const user = await this.prisma.user.create({
      data: {
        username: username,
        passwordHash,
        displayName: input?.displayName ?? username,
      },
      select: { id: true, username: true, displayName: true },
    });
    return user;
  }

  async validateUser(username: string, password: string) {
    const uname = username.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { username: uname },
    });
    if (!user) throw new UnauthorizedException('invalid_credentials');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('invalid_credentials');
    return user;
  }

  private async signAccess(user: { id: string; username: string }) {
    return await this.jwt.signAsync({ sub: user.id, username: user.username });
  }

  private async signRefresh(user: { id: string }) {
    return await this.jwt.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', {
          infer: true,
        }),
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_EXPIRES') ?? '30d',
      },
    );
  }

  async issueTokens(
    user: { id: string; username: string },
    ua?: string,
    ip?: string,
  ) {
    const access = await this.signAccess(user);
    const refresh = await this.signRefresh(user);
    const isDev = this.configService.get('NODE_ENV') !== 'production';
    const argonOpts = getArgonOptions(isDev);
    const refreshHash = await argon2.hash(refresh, argonOpts);

    const expiresAt = add(new Date(), { days: 30 });
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: refreshHash,
        userAgent: ua,
        ip,
        expiresAt,
      },
    });

    return { access, refresh };
  }

  async rotateRefresh(
    userId: string,
    oldRefresh: string,
    ua?: string,
    ip?: string,
  ) {
    const start = Date.now();
    // simple rotation (revoke old, create new)
    // AGGRESSIVE: Only check the 3 most recent sessions to speed up token refresh
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' }, // Check newest first
      take: 3, // Only check 3 most recent sessions
    });
    console.log(
      '🔍 Found',
      sessions.length,
      'recent sessions to check (limited to 3)',
      `(${Date.now() - start}ms)`,
    );

    let matched: string | null = null;

    const verifyStart = Date.now();
    const isDev = this.configService.get('NODE_ENV') !== 'production';
    const argonOpts = getArgonOptions(isDev);

    for (const s of sessions) {
      // argon2.verify doesn't accept options, but it will still be faster due to the hashed value being created with faster settings
      const ok = await argon2.verify(s.refreshTokenHash, oldRefresh);
      if (ok) {
        matched = s.id;
        break;
      }
    }
    console.log(
      '🔐 Argon2 verification completed',
      `(${Date.now() - verifyStart}ms)`,
    );

    if (!matched) throw new UnauthorizedException('invalid_refresh');

    await this.prisma.session.update({
      where: { id: matched },
      data: { revokedAt: new Date() },
    });

    const tokenStart = Date.now();
    const access = await this.signAccess({ id: userId, username: '' });
    const refresh = await this.signRefresh({ id: userId });
    const refreshHash = await argon2.hash(refresh, argonOpts);
    console.log(
      '🔑 Token generation + hashing',
      `(${Date.now() - tokenStart}ms)`,
    );

    const expiresAt = add(new Date(), { days: 30 });
    const dbStart = Date.now();
    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: refreshHash,
        userAgent: ua,
        ip,
        expiresAt,
      },
    });
    console.log('💾 Database session create', `(${Date.now() - dbStart}ms)`);
    console.log('✅ Total rotateRefresh time:', `(${Date.now() - start}ms)`);

    return { access, refresh };
  }

  async logout(userId: string, refresh: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
    });
    for (const s of sessions) {
      const ok = await argon2.verify(s.refreshTokenHash, refresh);
      if (ok) {
        await this.prisma.session.update({
          where: { id: s.id },
          data: { revokedAt: new Date() },
        });
        return { ok: true };
      }
    }
    return { ok: true };
  }

  async verifyAccess(token: string) {
    try {
      // Uses the default JwtModule secret configured in AuthModule
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET', {
          infer: true,
        }),
      });
      return payload as {
        sub: string;
        username?: string;
        iat: number;
        exp: number;
      };
    } catch {
      throw new UnauthorizedException('invalid_token');
    }
  }

  async verifyRefresh(token: string) {
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', {
          infer: true,
        }),
      });
      return payload as {
        sub: string;
        type: 'refresh';
        iat: number;
        exp: number;
      };
    } catch {
      throw new UnauthorizedException('invalid_refresh');
    }
  }
}
