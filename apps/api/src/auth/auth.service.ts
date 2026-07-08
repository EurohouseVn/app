import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { AuthUser, DemoAdminUser, LoginResponse, UserRole } from '@eurohouse/types';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from './current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(identifier: string, password: string): Promise<LoginResponse> {
    const value = identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: value }, { phone: identifier.trim() }] },
    });
    if (!user) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu.');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu.');
    }
    const payload: JwtUser = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      organizationId: user.organizationId ?? undefined,
    };
    const token = await this.jwtService.signAsync(payload);
    const result: DemoAdminUser = {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role as UserRole,
      token,
    };
    return { user: result, message: `Đăng nhập thành công với vai trò ${user.role}.` };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại.');
    }
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone ?? '',
      role: user.role as UserRole,
      organizationId: user.organizationId ?? undefined,
      organizationName: user.organization?.name,
      organizationType: user.organization?.type as AuthUser['organizationType'],
    };
  }
}
