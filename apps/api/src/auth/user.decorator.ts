import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    // set by JwtHttpGuard (req.user = { sub, username, ... })
    return req.user?.id as string | undefined;
  },
);
