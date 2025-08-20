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
      headers: any;
      cookies?: any;
      user?: any;
    }>();

    // Try to get token from cookie first, then fallback to Authorization header
    let token = req.cookies?.access || '';

    if (!token) {
      const h = req.headers?.authorization || '';
      token = h.startsWith('Bearer ') ? h.slice(7) : '';
    }

    if (!token) throw new UnauthorizedException('missing_token');

    try {
      const payload = await this.auth.verifyAccess(token); // make sure JwtModule secret matches your issuer
      (req as any).user = { id: payload.sub, name: payload?.username };
      return true;
    } catch {
      throw new UnauthorizedException('invalid_token');
    }
  }
}
