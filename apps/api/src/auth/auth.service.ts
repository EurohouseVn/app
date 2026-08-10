import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { AuthUser, DemoAdminUser, LoginResponse, RegisterFactoryInput, UserRole } from '@eurohouse/types';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from './current-user.decorator';

function parseModules(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

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
      include: { department: true, rbacRole: true, organization: true },
    });
    if (!user) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu.');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu.');
    }
    const modules = parseModules(user.moduleAccess);
    const permissions = parseModules(user.rbacRole?.permissions);
    const payload: JwtUser = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role as UserRole,
      organizationId: user.organizationId ?? undefined,
      organizationName: user.organization?.name,
      isCeo: user.isCeo,
      modules,
      departmentId: user.departmentId ?? undefined,
      permissions,
      rbacRoleId: user.rbacRoleId ?? undefined,
    };
    const token = await this.jwtService.signAsync(payload);
    const result: DemoAdminUser = {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role as UserRole,
      token,
      isCeo: user.isCeo,
      modules,
      departmentId: user.departmentId ?? undefined,
      departmentName: user.department?.name,
      jobTitle: user.jobTitle,
      permissions,
      rbacRoleId: user.rbacRoleId ?? undefined,
    };
    return { user: result, message: `Đăng nhập thành công với vai trò ${user.role}.` };
  }

  async registerFactory(input: RegisterFactoryInput): Promise<LoginResponse> {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const password = input.password.trim();
    const factoryCode = input.factoryCode.trim();

    if (!displayName) throw new BadRequestException('Tên người dùng không được để trống.');
    if (!email) throw new BadRequestException('Email không được để trống.');
    if (!password || password.length < 6) throw new BadRequestException('Mật khẩu cần tối thiểu 6 ký tự.');
    if (!factoryCode) throw new BadRequestException('Mã CSSX không được để trống.');

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email đã tồn tại.');

    const factory = await this.prisma.organization.findFirst({
      where: {
        type: 'FACTORY',
        code: { equals: factoryCode, mode: 'insensitive' },
        managedByNppId: { not: null },
      },
    });
    if (!factory) throw new BadRequestException('Mã CSSX không hợp lệ hoặc chưa được NPP kích hoạt.');

    const existingFactoryUser = await this.prisma.user.findFirst({
      where: {
        organizationId: factory.id,
        role: 'FACTORY',
      },
    });
    if (existingFactoryUser) {
      throw new BadRequestException('CSSX nay da co tai khoan. Vui long dang nhap hoac lien he NPP de cap lai thong tin.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.create({
      data: {
        email,
        displayName,
        phone: input.phone?.trim() || null,
        passwordHash,
        role: 'FACTORY',
        organizationId: factory.id,
      },
    });

    return this.login(email, password);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true, department: true, rbacRole: true },
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
      isCeo: user.isCeo,
      modules: parseModules(user.moduleAccess),
      departmentId: user.departmentId ?? undefined,
      departmentName: user.department?.name,
      jobTitle: user.jobTitle,
      permissions: parseModules(user.rbacRole?.permissions),
      rbacRoleId: user.rbacRoleId ?? undefined,
    };
  }
}
