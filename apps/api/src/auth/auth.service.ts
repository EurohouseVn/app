import { BadRequestException, ForbiddenException, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import {
  formulaCapabilityFromStatus,
  featureCapability,
  PUBLIC_WORKSHOP_DEFAULT_MODULE_KEYS,
  type AuthUser,
  type DemoAdminUser,
  type LoginResponse,
  type RegisterFactoryInput,
  type RegisterWorkshopInput,
  type UserRole,
  type VerificationConfirmInput,
} from '@eurohouse/types';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from './current-user.decorator';
import { normalizeIdentity, normalizeOptionalIdentities } from './identity-normalization';
import { VerificationService } from './verification.service';
import { DeviceSessionService, type DeviceKind } from './device-session.service';
import { FormulaAccessService } from '../modules/formula-access/formula-access.service';
import { EurohouseAccessService } from '../modules/eurohouse-access/eurohouse-access.service';

/** Vai trò đánh dấu tài khoản đã bị người dùng tự xóa (đã ẩn danh hóa, không đăng nhập lại được). */
export const DELETED_ROLE = 'DELETED';
const DELETED_DISPLAY_NAME = 'Tài khoản đã xóa';
const DELETED_ORGANIZATION_NAME = 'Cơ sở đã xóa';

export type LoginDeviceInfo = { kind?: DeviceKind; label?: string; userAgent?: string; revokeSessionId?: string };

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
    private readonly verificationService: VerificationService,
    @Optional() private readonly formulaAccessService?: FormulaAccessService,
    @Optional() private readonly eurohouseAccessService?: EurohouseAccessService,
    @Optional() private readonly deviceSessions?: DeviceSessionService,
  ) {}

  async login(identifier: string, password: string, device?: LoginDeviceInfo): Promise<LoginResponse> {
    let identity;
    try {
      identity = normalizeIdentity(identifier);
    } catch {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu.');
    }
    const user = await this.prisma.user.findFirst({
      where: identity.kind === 'EMAIL'
        ? { OR: [{ emailNormalized: identity.normalized }, { email: identity.normalized }] }
        : { OR: [{ phoneNormalized: identity.normalized }, { phone: identifier.trim() }] },
      include: { department: true, rbacRole: true, organization: true },
    });
    if (!user) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu.');
    }
    if (!user.verifiedAt) throw new UnauthorizedException('VERIFICATION_REQUIRED');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu.');
    }
    return this.issueLogin(user, device);
  }

  private async issueLogin(user: any, device?: LoginDeviceInfo): Promise<LoginResponse> {
    const modules = parseModules(user.moduleAccess);
    const permissions = parseModules(user.rbacRole?.permissions);
    const payload: JwtUser = {
      sub: user.id,
      email: user.email ?? undefined,
      displayName: user.displayName,
      role: user.role as UserRole,
      organizationId: user.organizationId ?? undefined,
      organizationName: user.organization?.name,
      organizationProvince: user.organization?.province ?? undefined,
      isCeo: user.isCeo,
      modules,
      departmentId: user.departmentId ?? undefined,
      permissions,
      rbacRoleId: user.rbacRoleId ?? undefined,
    };
    // NPP đăng nhập theo thiết bị: mỗi NPP tối đa 2 máy tính và 3 điện thoại (DEVICE_LIMIT nếu vượt, xem device-session.service.ts).
    if (user.role === 'NPP' && user.organizationId && this.deviceSessions) {
      const kind: DeviceKind = device?.kind ?? 'DESKTOP';
      const session = await this.deviceSessions.register({
        userId: user.id,
        organizationId: user.organizationId,
        kind,
        label: device?.label?.trim() || (kind === 'PHONE' ? 'Điện thoại' : 'Máy tính'),
        userAgent: device?.userAgent,
        revokeSessionId: device?.revokeSessionId,
      });
      payload.sid = session.id;
    }
    const token = await this.jwtService.signAsync(payload);
    const result: DemoAdminUser = {
      id: user.id,
      displayName: user.displayName,
      email: user.email ?? '',
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

  async registerWorkshop(input: RegisterWorkshopInput): Promise<{ pendingVerificationId: string; maskedTarget: string }> {
    const displayName = input.displayName.trim();
    const organizationName = input.organizationName.trim();
    const password = input.password.trim();
    if (!displayName || !organizationName) throw new BadRequestException('WORKSHOP_NAME_REQUIRED');
    if (password.length < 6) throw new BadRequestException('PASSWORD_TOO_SHORT');
    if (!input.email?.trim()) throw new BadRequestException('EMAIL_REQUIRED');

    let identities;
    try {
      identities = normalizeOptionalIdentities(input.email, input.phone);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    if (!identities.emailNormalized) throw new BadRequestException('EMAIL_REQUIRED');
    const duplicate = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(identities.emailNormalized ? [{ emailNormalized: identities.emailNormalized }] : []),
          ...(identities.phoneNormalized ? [{ phoneNormalized: identities.phoneNormalized }] : []),
        ],
      },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException('IDENTIFIER_ALREADY_USED');

    const passwordHash = await bcrypt.hash(password, 10);
    const code = `CSSX-${randomBytes(6).toString('hex').toUpperCase()}`;
    const user = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          code,
          name: organizationName,
          type: 'FACTORY',
          province: input.province?.trim() || null,
          email: identities.emailNormalized ?? null,
          phone: input.phone?.trim() || null,
        },
      });
      const created = await tx.user.create({
        data: {
          email: identities.emailNormalized ?? null,
          emailNormalized: identities.emailNormalized ?? null,
          phone: input.phone?.trim() || null,
          phoneNormalized: identities.phoneNormalized ?? null,
          displayName,
          passwordHash,
          role: 'FACTORY',
          organizationId: organization.id,
          moduleAccess: JSON.stringify(PUBLIC_WORKSHOP_DEFAULT_MODULE_KEYS),
          verifiedAt: null,
        },
      });
      // Mỗi xưởng có cấu hình riêng, độc lập với xưởng khác; các module vận hành của xưởng được bật sẵn.
      await tx.workshopPilotConfig.create({
        data: {
          organizationId: organization.id, active: true,
          survey: true, inventory: true, shopFloor: true, quality: true, installation: true, warranty: true,
          version: 1, enabledAt: new Date(), updatedById: created.id,
        },
      });
      return created;
    });
    const channel = 'EMAIL' as const;
    const target = identities.emailNormalized;
    try {
      await this.verificationService.create(user.id, channel, target);
    } catch (deliveryError) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.delete({ where: { id: user.id } });
        await tx.workshopPilotConfig.deleteMany({ where: { organizationId: user.organizationId! } });
        await tx.organization.delete({ where: { id: user.organizationId! } });
      }).catch(() => undefined);
      throw deliveryError;
    }
    return { pendingVerificationId: user.id, maskedTarget: maskIdentity(target) };
  }

  /**
   * Đăng ký nhanh bằng số điện thoại cho thợ không dùng email: không gửi mã xác minh, vào app ngay.
   * Số điện thoại chưa được xác minh nên `verificationChannel` để trống (phân biệt với tài khoản đã xác minh).
   */
  async registerWorkshopByPhone(input: { organizationName: string; address: string; phone: string; password: string }): Promise<LoginResponse> {
    const organizationName = input.organizationName?.trim() ?? '';
    const address = input.address?.trim() ?? '';
    const password = input.password?.trim() ?? '';
    if (!organizationName) throw new BadRequestException('WORKSHOP_NAME_REQUIRED');
    if (!address) throw new BadRequestException('ADDRESS_REQUIRED');
    if (password.length < 6) throw new BadRequestException('PASSWORD_TOO_SHORT');
    let identity;
    try {
      identity = normalizeIdentity(input.phone ?? '');
    } catch {
      throw new BadRequestException('INVALID_IDENTIFIER');
    }
    if (identity.kind !== 'PHONE') throw new BadRequestException('INVALID_IDENTIFIER');
    const duplicate = await this.prisma.user.findFirst({ where: { OR: [{ phoneNormalized: identity.normalized }] }, select: { id: true } });
    if (duplicate) throw new BadRequestException('IDENTIFIER_ALREADY_USED');

    const passwordHash = await bcrypt.hash(password, 10);
    const code = `CSSX-${randomBytes(6).toString('hex').toUpperCase()}`;
    const phone = input.phone.trim();
    const user = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { code, name: organizationName, type: 'FACTORY', address, phone },
      });
      const created = await tx.user.create({
        data: {
          email: null,
          emailNormalized: null,
          phone,
          phoneNormalized: identity.normalized,
          displayName: organizationName,
          passwordHash,
          role: 'FACTORY',
          organizationId: organization.id,
          moduleAccess: JSON.stringify(PUBLIC_WORKSHOP_DEFAULT_MODULE_KEYS),
          verifiedAt: new Date(),
          verificationChannel: null,
        },
      });
      await tx.workshopPilotConfig.create({
        data: {
          organizationId: organization.id, active: true,
          survey: true, inventory: true, shopFloor: true, quality: true, installation: true, warranty: true,
          version: 1, enabledAt: new Date(), updatedById: created.id,
        },
      });
      return { ...created, organization };
    });
    return this.issueLogin(user);
  }

  async confirmWorkshopVerification(input: VerificationConfirmInput): Promise<LoginResponse> {
    const verified = await this.verificationService.confirm(input.pendingVerificationId, input.code);
    await this.prisma.user.update({
      where: { id: verified.userId },
      data: { verifiedAt: verified.consumedAt, verificationChannel: verified.channel },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: verified.userId },
      include: { department: true, rbacRole: true, organization: true },
    });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại.');
    return this.issueLogin(user);
  }

  resendWorkshopVerification(pendingVerificationId: string) {
    return this.verificationService.resend(pendingVerificationId);
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
        emailNormalized: email,
        displayName,
        phone: input.phone?.trim() || null,
        phoneNormalized: input.phone?.trim() ? normalizeIdentity(input.phone).normalized : null,
        passwordHash,
        role: 'FACTORY',
        organizationId: factory.id,
        verifiedAt: new Date(),
        verificationChannel: 'EMAIL',
      },
    });

    return this.login(email, password);
  }

  /**
   * Người dùng tự xóa tài khoản trong app (bắt buộc theo App Store Guideline 5.1.1(v)).
   * Không xóa cứng vì đơn hàng, báo giá, sổ quỹ... còn phải giữ theo nghĩa vụ kế toán: ẩn danh hóa danh tính
   * (email, số điện thoại, tên, mật khẩu) và thông tin liên hệ của cơ sở nếu người này là người dùng duy nhất của cơ sở.
   * Chỉ áp dụng cho tài khoản xưởng/đại lý tự đăng ký; tài khoản nội bộ và NPP do công ty quản lý.
   */
  async deleteAccount(userId: string, password: string): Promise<{ deleted: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role === DELETED_ROLE) throw new UnauthorizedException('Tài khoản không tồn tại.');
    if (user.role !== 'FACTORY' && user.role !== 'DAILY') throw new ForbiddenException('ACCOUNT_DELETE_NOT_ALLOWED');
    if (!password || !(await bcrypt.compare(password, user.passwordHash))) throw new BadRequestException('INVALID_PASSWORD');

    const lockedHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.verificationChallenge.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          email: null,
          emailNormalized: null,
          phone: null,
          phoneNormalized: null,
          displayName: DELETED_DISPLAY_NAME,
          passwordHash: lockedHash,
          role: DELETED_ROLE,
          moduleAccess: '[]',
          verifiedAt: null,
          verificationChannel: null,
        },
      });
      if (user.organizationId) {
        const others = await tx.user.count({
          where: { organizationId: user.organizationId, id: { not: userId }, role: { not: DELETED_ROLE } },
        });
        if (others === 0) {
          await tx.organization.update({
            where: { id: user.organizationId },
            data: {
              name: DELETED_ORGANIZATION_NAME,
              productionName: null,
              phone: null,
              address: null,
              email: null,
              fanpage: null,
              logoUrl: null,
              mainCategories: null,
            },
          });
        }
      }
    });
    return { deleted: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true, department: true, rbacRole: true },
    });
    if (!user || user.role === DELETED_ROLE) {
      throw new UnauthorizedException('Tài khoản không tồn tại.');
    }
    // Công thức cắt mở cho mọi tài khoản; chỉ Đặt hàng Nhôm Eurohouse còn cần mã mời của NPP.
    const legacyFormula = formulaCapabilityFromStatus('ACTIVE');
    const eurohouse = this.eurohouseAccessService
      ? await this.eurohouseAccessService.getAccessView(user.organizationId ?? undefined)
      : {
          organizationId: user.organizationId ?? '',
          features: {
            FORMULA_CUTTING: featureCapability('ACTIVE', 'FORMULA_CUTTING'),
            EUROHOUSE_ORDERING: featureCapability('LOCKED', 'EUROHOUSE_ORDERING'),
          },
        };
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email ?? undefined,
      phone: user.phone ?? '',
      role: user.role as UserRole,
      organizationId: user.organizationId ?? undefined,
      organizationName: user.organization?.name,
      organizationType: user.organization?.type as AuthUser['organizationType'],
      organizationProvince: user.organization?.province ?? undefined,
      isCeo: user.isCeo,
      modules: parseModules(user.moduleAccess),
      departmentId: user.departmentId ?? undefined,
      departmentName: user.department?.name,
      jobTitle: user.jobTitle,
      permissions: parseModules(user.rbacRole?.permissions),
      rbacRoleId: user.rbacRoleId ?? undefined,
      capabilities: {
        formulas: legacyFormula,
        eurohouse,
      },
    };
  }
}

function maskIdentity(value: string): string {
  const at = value.indexOf('@');
  if (at > 1) return `${value.slice(0, 2)}***${value.slice(at)}`;
  return `${value.slice(0, 4)}***${value.slice(-3)}`;
}
