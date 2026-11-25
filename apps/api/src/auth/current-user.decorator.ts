import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@eurohouse/types';

export interface JwtUser {
  sub: string;
  email?: string;
  displayName?: string;
  role: UserRole;
  organizationId?: string;
  organizationName?: string;
  organizationProvince?: string;
  isCeo?: boolean;
  modules?: string[];
  departmentId?: string;
  permissions?: string[];
  rbacRoleId?: string;
  /** Id phiên thiết bị (chỉ token NPP); gỡ phiên là thu hồi token ngay. */
  sid?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    return request.user;
  },
);
