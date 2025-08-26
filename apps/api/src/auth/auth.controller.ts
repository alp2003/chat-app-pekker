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
    const isProduction = this.cfg.get('NODE_ENV') === 'production';

    res.cookie('refresh', refresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30d
      path: '/',
    });

    res.cookie('access', access, {
      httpOnly: true,
      sameSite: 'lax', // Use lax for broader compatibility
      secure: isProduction, 
      maxAge: 1000 * 60 * 60, // 1 hour for testing to eliminate race conditions
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

      const result = await this.auth.rotateRefresh(
        userId,
        token,
        req.headers['user-agent'] as string,
        req.ip,
      );

      const { access, refresh, user } = result;

      console.log('🔄 New tokens generated, setting cookies...');

      const isProduction = this.cfg.get('NODE_ENV') === 'production';

      res.cookie('refresh', refresh, {
        httpOnly: true,
        sameSite: 'lax', // Use lax for broader compatibility
        secure: isProduction, 
        maxAge: 1000 * 60 * 60 * 24 * 30,
        path: '/',
      });

      res.cookie('access', access, {
        httpOnly: true,
        sameSite: 'lax', // Use lax for broader compatibility
        secure: isProduction, 
        maxAge: 1000 * 60 * 60, // 1 hour for testing to eliminate race conditions
        path: '/',
      });

      console.log('✅ Cookies set successfully');
      return {
        ok: true,
        user: {
          id: user.id,
          username: user.username,
        },
      };
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
    let logoutResult = { ok: true, sessionRevoked: false };

    // Only attempt to revoke session if we have a valid refresh token
    if (token) {
      try {
        // Decode JWT to get user ID (don't verify signature, just extract payload)
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1] || '', 'base64').toString() || '{}',
        ) as { sub?: string };

        const { sub: userId } = payload;
        if (userId) {
          logoutResult = await this.auth.logout(userId, token);
        }
      } catch (error) {
        // Log error but don't fail logout - token might be malformed
        console.warn('Failed to parse refresh token during logout:', error);
      }
    }

    // Always clear cookies regardless of server-side logout success
    // This ensures the client is logged out even if server cleanup fails
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS in production
      sameSite: 'lax' as const,
    };

    res.clearCookie('refresh', cookieOptions);
    res.clearCookie('access', cookieOptions);

    // Also clear non-httpOnly cookies that might exist
    res.clearCookie('u_token', { path: '/' });
    res.clearCookie('u_name', { path: '/' });

    return {
      ok: true,
      sessionRevoked: logoutResult.sessionRevoked,
      message: 'Logged out successfully',
    };
  }
}
