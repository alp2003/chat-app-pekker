import { Controller, Get, Query, Body, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { ZodBody } from '../common/zod.pipe';
import { LoginDto, RegisterDto } from 'shared/dto';
import { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private cfg: ConfigService,
  ) {}

  @Get('debug-token')
  async debugToken(
    @Query('username') username: string,
    @Query('password') password: string,
  ) {
    const {
      id,
      username: uname,
      displayName,
    } = await this.auth.register({
      username: username,
      password: password,
      displayName: username,
    });
    return { id, uname, displayName };
  }

  @Get('debug-jwt-health')
  health() {
    return {
      hasSecret: !!this.cfg.get<string>('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.cfg.get<string>('JWT_ACCESS_EXPIRES') ?? '1h',
    };
  }

  @Post('register')
  async register(@Body(new ZodBody(RegisterDto)) body: any) {
    const user = await this.auth.register(body);
    return { user };
  }

  @Post('login')
  async login(
    @Body(new ZodBody(LoginDto)) body: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.validateUser(body.username, body.password);
    const { access, refresh } = await this.auth.issueTokens(
      { id: user.id, username: user.username },
      req.headers['user-agent'] as string,
      req.ip,
    );

    // httpOnly cookies for both tokens
    res.cookie('refresh', refresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cfg.get('NODE_ENV') === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30d
      path: '/auth',
    });

    res.cookie('access', access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cfg.get('NODE_ENV') === 'production',
      maxAge: 1000 * 60 * 60, // 1 hour
      path: '/',
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies?.refresh as string) || '';
    if (!token) {
      return { error: 'no_refresh_token' };
    }

    try {
      // Use proper JWT verification instead of manual parsing
      const payload = await this.auth.verifyRefresh(token);
      const userId = payload.sub;

      const { access, refresh } = await this.auth.rotateRefresh(
        userId,
        token,
        req.headers['user-agent'] as string,
        req.ip,
      );

      res.cookie('refresh', refresh, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.cfg.get('NODE_ENV') === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 30,
        path: '/auth',
      });

      res.cookie('access', access, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.cfg.get('NODE_ENV') === 'production',
        maxAge: 1000 * 60 * 60, // 1 hour
        path: '/',
      });

      return { ok: true };
    } catch (error) {
      return { error: 'invalid_refresh_token' };
    }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies?.refresh as string) || '';
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1] || '', 'base64').toString() || '{}',
      );
      const { sub: userId } = payload as { sub?: string };
      if (userId) await this.auth.logout(userId, token);
    } catch {}
    res.clearCookie('refresh', { path: '/auth' });
    res.clearCookie('access', { path: '/' });
    return { ok: true };
  }
}
