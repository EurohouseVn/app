import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CEO_ONLY_KEY, MODULE_KEY } from './module.decorator';
import type { JwtUser } from './current-user.decorator';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const ceoOnly = this.reflector.getAllAndOverride<boolean | undefined>(CEO_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const moduleKey = this.reflector.getAllAndOverride<string | undefined>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!ceoOnly && !moduleKey) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng này.');
    }
    // CEO toàn quyền
    if (user.isCeo) return true;

    if (ceoOnly) {
      throw new ForbiddenException('Chỉ CEO mới được thực hiện thao tác này.');
    }
    if (moduleKey && !(user.modules ?? []).includes(moduleKey)) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng này.');
    }
    return true;
  }
}
