import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type {
  AdminUserItem,
  CreateNppInput,
  CreateUserInput,
  Department,
  UpdateUserInput,
  OrgItem,
  UpdateOrgInput,
} from '@eurohouse/types';
import { ADMIN_MODULE_KEYS } from '@eurohouse/types';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_USER_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? 'Eurohouse@2026';

function serializeModules(modules: string[] | undefined): string {
  const valid = (modules ?? []).filter((m) => ADMIN_MODULE_KEYS.includes(m));
  return JSON.stringify(Array.from(new Set(valid)));
}

function parseModules(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeCodePart(value: string): string {
  const noMarks = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  return noMarks.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 18) || 'NPP';
}

@Injectable()
export class AdminIamService {
  constructor(private readonly prisma: PrismaService) {}

  async adminUsers(): Promise<AdminUserItem[]> {
    const users = await this.prisma.user.findMany({
      include: { organization: true, department: true },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.toAdminUserItem(u));
  }

  private toAdminUserItem(u: {
    id: string; displayName: string; email: string; phone: string | null; role: string;
    organizationId: string | null; organization: { name: string; type: string } | null;
    departmentId: string | null; department: { name: string } | null;
    jobTitle: string; isCeo: boolean; moduleAccess: string; points: number; createdAt: Date;
  }): AdminUserItem {
    return {
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      phone: u.phone ?? '',
      role: u.role as AdminUserItem['role'],
      organizationId: u.organizationId ?? undefined,
      organizationName: u.organization?.name,
      organizationType: u.organization?.type as AdminUserItem['organizationType'],
      departmentId: u.departmentId ?? undefined,
      departmentName: u.department?.name,
      jobTitle: u.jobTitle,
      isCeo: u.isCeo,
      modules: parseModules(u.moduleAccess),
      points: u.points,
      createdAt: u.createdAt.toISOString(),
    };
  }

  // ---------- Phòng ban & phân quyền (RBAC nội bộ, CEO quản lý) ----------

  async listDepartments(): Promise<Department[]> {
    const depts = await this.prisma.department.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return depts.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      parentId: d.parentId ?? undefined,
      sortOrder: d.sortOrder,
      userCount: d._count.users,
    }));
  }

  async createUser(input: CreateUserInput): Promise<AdminUserItem> {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new BadRequestException('Email không được để trống.');
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email đã tồn tại.');
    const passwordHash = await bcrypt.hash(input.password?.trim() || DEFAULT_USER_PASSWORD, 10);
    const created = await this.prisma.user.create({
      data: {
        email,
        displayName: input.displayName.trim(),
        phone: input.phone?.trim() || null,
        role: input.role,
        organizationId: input.organizationId || null,
        departmentId: input.departmentId || null,
        jobTitle: input.jobTitle?.trim() ?? '',
        isCeo: input.isCeo ?? false,
        moduleAccess: serializeModules(input.modules),
        passwordHash,
      },
      include: { organization: true, department: true },
    });
    return this.toAdminUserItem(created);
  }

  async createNpp(input: CreateNppInput): Promise<{ organization: OrgItem; user: AdminUserItem; password: string }> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name) throw new BadRequestException('Ten NPP khong duoc de trong.');
    if (!email) throw new BadRequestException('Email dang nhap NPP khong duoc de trong.');

    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw new BadRequestException('Email da ton tai.');

    const requestedCode = input.code?.trim() ? normalizeCodePart(input.code) : normalizeCodePart(name);
    let code = requestedCode.startsWith('NPP') ? requestedCode : `NPP-${requestedCode}`;
    let suffix = 1;
    while (await this.prisma.organization.findUnique({ where: { code } })) {
      suffix += 1;
      code = `${requestedCode.startsWith('NPP') ? requestedCode : `NPP-${requestedCode}`}-${suffix}`;
    }

    const password = input.password?.trim() || DEFAULT_USER_PASSWORD;
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          code,
          name,
          type: 'NPP',
          shortLabel: input.shortLabel?.trim() || code,
          phone: input.phone?.trim() || null,
          address: input.address?.trim() || null,
          province: input.province?.trim() || null,
          email,
        },
      });

      const existingNppUser = await tx.user.findFirst({
        where: { organizationId: organization.id, role: 'NPP' },
      });
      if (existingNppUser) throw new BadRequestException('NPP nay da co tai khoan.');

      const user = await tx.user.create({
        data: {
          email,
          displayName: input.displayName?.trim() || name,
          phone: input.phone?.trim() || null,
          passwordHash,
          role: 'NPP',
          organizationId: organization.id,
          jobTitle: 'Tai khoan NPP',
          moduleAccess: '[]',
        },
        include: { organization: true, department: true },
      });

      return { organization, user };
    });

    const orgs = await this.adminOrgs();
    const organization = orgs.find((org) => org.id === result.organization.id);
    if (!organization) throw new NotFoundException('Khong tim thay NPP vua tao.');
    return {
      organization,
      user: this.toAdminUserItem(result.user),
      password,
    };
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<AdminUserItem> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
    const data: Record<string, unknown> = {};
    if (input.displayName !== undefined) data.displayName = input.displayName.trim();
    if (input.phone !== undefined) data.phone = input.phone.trim() || null;
    if (input.role !== undefined) data.role = input.role;
    if (input.organizationId !== undefined) data.organizationId = input.organizationId || null;
    if (input.departmentId !== undefined) data.departmentId = input.departmentId || null;
    if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle.trim();
    if (input.isCeo !== undefined) data.isCeo = input.isCeo;
    if (input.modules !== undefined) data.moduleAccess = serializeModules(input.modules);
    if (input.password && input.password.trim()) {
      data.passwordHash = await bcrypt.hash(input.password.trim(), 10);
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: { organization: true, department: true },
    });
    return this.toAdminUserItem(updated);
  }

  async setUserModules(id: string, modules: string[]): Promise<AdminUserItem> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { moduleAccess: serializeModules(modules) },
      include: { organization: true, department: true },
    });
    return this.toAdminUserItem(updated);
  }

  async adminOrgs(): Promise<OrgItem[]> {
    const orgs = await this.prisma.organization.findMany({
      include: { _count: { select: { users: true } }, managedByNpp: true },
      orderBy: { createdAt: 'asc' },
    });
    return orgs.map((o) => ({
      id: o.id,
      code: o.code,
      name: o.name,
      type: o.type as OrgItem['type'],
      phone: o.phone ?? undefined,
      address: o.address ?? undefined,
      shortLabel: o.shortLabel ?? undefined,
      userCount: o._count.users,
      managedByNppId: o.managedByNppId ?? undefined,
      managedByNppName: o.managedByNpp?.name,
    }));
  }

  async updateOrg(orgId: string, data: { managedByNppId?: string | null; shortLabel?: string | null }): Promise<OrgItem> {
    const update: Record<string, unknown> = {};
    if ('managedByNppId' in data) update.managedByNppId = data.managedByNppId;
    if ('shortLabel' in data) update.shortLabel = data.shortLabel ?? null;
    await this.prisma.organization.update({ where: { id: orgId }, data: update });
    const orgs = await this.adminOrgs();
    const updated = orgs.find((o) => o.id === orgId);
    if (!updated) throw new NotFoundException('Không tìm thấy tổ chức.');
    return updated;
  }
}
