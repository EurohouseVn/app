import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtUser } from './current-user.decorator';
import { DeviceSessionService } from './device-session.service';

interface AuthRequest {
  headers: { authorization?: string };
  user?: JwtUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService, @Optional() private readonly sessions?: DeviceSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Bạn cần đăng nhập để tiếp tục.');
    }
    let user: JwtUser;
    try {
      user = this.jwtService.verify<JwtUser>(token);
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }
    // Token NPP gắn với một phiên thiết bị: phiên đã bị gỡ hoặc hết hạn thì từ chối ngay.
    if (user.sid && this.sessions) await this.sessions.assertActive(user.sid);
    request.user = user;
    return true;
  }

  private extractToken(request: AuthRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, value] = header.split(' ');
    return type === 'Bearer' ? value : undefined;
  }
}
