import { Controller, Get, Query, Body, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { ZodBody } from '../common/zod.pipe';
import { LoginDto, RegisterDto, LoginInput, RegisterInput } from 'shared/dto';
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
  async register(@Body(new ZodBody(RegisterDto)) body: RegisterInput) {
    const user = await this.auth.register(body);
    return { user };
  }

  @Post('login')
  async login(
    @Body(new ZodBody(LoginDto)) body: LoginInput,
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
      path: '/',
    });

    res.cookie('access', access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cfg.get('NODE_ENV') === 'production',
      maxAge: 1000 * 300, // 5 minutes for testing to eliminate race conditions
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
    console.log('🔄 Backend refresh endpoint called');
    const token = (req.cookies?.refresh as string) || '';
    if (!token) {
      console.log('❌ No refresh token found in cookies');
      return { error: 'no_refresh_token' };
    }

    console.log('🍪 Backend received refresh token:', token.slice(-20));

    try {
      // Use proper JWT verification instead of manual parsing
      const payload = await this.auth.verifyRefresh(token);
      const userId = payload.sub;

      console.log('✅ Refresh token valid for user:', userId);

      const { access, refresh } = await this.auth.rotateRefresh(
        userId,
        token,
        req.headers['user-agent'] as string,
        req.ip,
      );

      console.log('🔄 New tokens generated, setting cookies...');

      res.cookie('refresh', refresh, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.cfg.get('NODE_ENV') === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 30,
        path: '/',
      });

      res.cookie('access', access, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.cfg.get('NODE_ENV') === 'production',
        maxAge: 1000 * 300, // 5 minutes for testing to eliminate race conditions
        path: '/',
      });

      console.log('✅ Cookies set successfully');
      return { ok: true };
    } catch (error) {
      console.log(
        '❌ Refresh token validation failed:',
        error instanceof Error ? error.message : error,
      );
      return { error: 'invalid_refresh_token' };
    }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies?.refresh as string) || '';
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1] || '', 'base64').toString() || '{}',
      ) as { sub?: string };
      const { sub: userId } = payload;
      if (userId) await this.auth.logout(userId, token);
    } catch {
      // Ignore errors when parsing invalid refresh token
    }
    res.clearCookie('refresh', { path: '/' });
    res.clearCookie('access', { path: '/' });
    return { ok: true };
  }
}
