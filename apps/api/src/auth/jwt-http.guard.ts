import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class JwtHttpGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      headers: { authorization?: string };
      cookies?: { access?: string };
      user?: { id: string; name?: string };
    }>();

    // Try to get token from cookie first, then fallback to Authorization header
    const token = req.cookies?.access || '';

    if (!token) {
      const authHeader = req.headers?.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : '';
      if (!bearerToken) throw new UnauthorizedException('missing_token');
    }

    const finalToken =
      token ||
      (req.headers?.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : '');

    if (!finalToken) throw new UnauthorizedException('missing_token');

    try {
      const payload = await this.auth.verifyAccess(finalToken);
      req.user = { id: payload.sub, name: payload?.username };
      return true;
    } catch {
      throw new UnauthorizedException('invalid_token');
    }
  }
}
