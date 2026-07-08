import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@eurohouse/types';

export interface JwtUser {
  sub: string;
  email: string;
  role: UserRole;
  organizationId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    return request.user;
  },
);
