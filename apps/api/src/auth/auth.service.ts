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
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
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
    const refreshHash = await argon2.hash(refresh, { type: argon2.argon2id });

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
    // simple rotation (revoke old, create new)
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
    });
    let matched: string | null = null;

    for (const s of sessions) {
      const ok = await argon2.verify(s.refreshTokenHash, oldRefresh);
      if (ok) {
        matched = s.id;
        break;
      }
    }
    if (!matched) throw new UnauthorizedException('invalid_refresh');

    await this.prisma.session.update({
      where: { id: matched },
      data: { revokedAt: new Date() },
    });

    const access = await this.signAccess({ id: userId, username: '' });
    const refresh = await this.signRefresh({ id: userId });
    const refreshHash = await argon2.hash(refresh, { type: argon2.argon2id });

    const expiresAt = add(new Date(), { days: 30 });
    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: refreshHash,
        userAgent: ua,
        ip,
        expiresAt,
      },
    });

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
