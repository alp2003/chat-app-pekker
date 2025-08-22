import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ user?: { id: string } }>();
    // set by JwtHttpGuard (req.user = { id, name, ... })
    return req.user?.id || '';
  },
);
