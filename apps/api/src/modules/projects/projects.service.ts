import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ProjectDetail, ProjectSummary } from '@eurohouse/types';
import type { JwtUser } from '../../auth/current-user.decorator';

function projectTotalCost(p: {
  costAluminum: number;
  costAccessory: number;
  costLockHinge: number;
  costGasket: number;
  costSilicone: number;
  costScrew: number;
  costGlass: number;
  costLabor: number;
  costOther: number;
  costPartnerPct: number;
  contractValue: number;
  extraRevenue: number;
}): number {
  const base =
    p.costAluminum +
    p.costAccessory +
    p.costLockHinge +
    p.costGasket +
    p.costSilicone +
    p.costScrew +
    p.costGlass +
    p.costLabor +
    p.costOther;
  const partner = Math.round(((p.contractValue + p.extraRevenue) * p.costPartnerPct) / 100);
  return base + partner;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private hasGlobalProjectAccess(user?: JwtUser): boolean {
    return !user || user.isCeo === true || user.role === 'ADMIN' || user.role === 'STAFF';
  }

  private assertCanAccessProject(project: { ownerId: string | null }, user?: JwtUser) {
    if (this.hasGlobalProjectAccess(user)) return;
    if (project.ownerId === user?.sub) return;
    throw new ForbiddenException('Khong co quyen truy cap cong trinh nay.');
  }

  async listProjects(user?: JwtUser, mine = false): Promise<ProjectSummary[]> {
    const ownerId = !this.hasGlobalProjectAccess(user) || mine ? user?.sub : undefined;
    const projects = await this.prisma.project.findMany({
      where: ownerId ? { ownerId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => this.toProjectSummary(p));
  }

  private toProjectSummary(p: import('@prisma/client').Project): ProjectSummary {
    const totalCost = projectTotalCost(p);
    const revenue = p.contractValue + p.extraRevenue;
    const profit = revenue - totalCost;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      customerName: p.customerName,
      status: p.status as ProjectSummary['status'],
      contractValue: p.contractValue,
      totalCost,
      profit,
      profitPct: revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0,
    };
  }

  async getProject(id: string, user?: JwtUser): Promise<ProjectDetail> {
    const p = await this.prisma.project.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Khong tim thay cong trinh.');
    this.assertCanAccessProject(p, user);
    const summary = this.toProjectSummary(p);
    return {
      ...summary,
      customerPhone: p.customerPhone,
      address: p.address,
      costAluminum: p.costAluminum,
      costAccessory: p.costAccessory,
      costLockHinge: p.costLockHinge,
      costGasket: p.costGasket,
      costSilicone: p.costSilicone,
      costScrew: p.costScrew,
      costGlass: p.costGlass,
      costLabor: p.costLabor,
      costPartnerPct: p.costPartnerPct,
      costOther: p.costOther,
      extraRevenue: p.extraRevenue,
      note: p.note,
      estimatedValue: p.estimatedValue,
      incurredValue: p.incurredValue,
      incurredType: p.incurredType,
      settledValue: p.settledValue,
      quotationId: p.quotationId ?? undefined,
      images: p.images || [],
    };
  }

  async createProject(data: Partial<ProjectDetail>, ownerId?: string, user?: JwtUser): Promise<ProjectDetail> {
    const count = await this.prisma.project.count();
    const created = await this.prisma.project.create({
      data: {
        code: `CT-${String(count + 1).padStart(4, '0')}`,
        name: data.name ?? 'Cong trinh moi',
        ownerId: ownerId ?? null,
        customerName: data.customerName ?? '',
        customerPhone: data.customerPhone ?? '',
        address: data.address ?? '',
        contractValue: data.contractValue ?? 0,
        estimatedValue: data.estimatedValue ?? 0,
        incurredValue: data.incurredValue ?? 0,
        incurredType: data.incurredType ?? 'INCREASE',
        settledValue: data.settledValue ?? 0,
        quotationId: data.quotationId ?? null,
        images: data.images ?? [],
      },
    });
    return this.getProject(created.id, user);
  }

  async updateProject(id: string, data: Partial<ProjectDetail>, user?: JwtUser): Promise<ProjectDetail> {
    await this.getProject(id, user);
    const allowed = [
      'name',
      'customerName',
      'customerPhone',
      'address',
      'status',
      'contractValue',
      'costAluminum',
      'costAccessory',
      'costLockHinge',
      'costGasket',
      'costSilicone',
      'costScrew',
      'costGlass',
      'costLabor',
      'costPartnerPct',
      'costOther',
      'extraRevenue',
      'note',
      'estimatedValue',
      'incurredValue',
      'incurredType',
      'settledValue',
      'quotationId',
      'images',
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in data) updateData[key] = (data as Record<string, unknown>)[key];
    }
    await this.prisma.project.update({ where: { id }, data: updateData });
    return this.getProject(id, user);
  }

  async deleteProject(id: string, user?: JwtUser): Promise<boolean> {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Khong tim thay cong trinh.');
    this.assertCanAccessProject(existing, user);
    await this.prisma.project.delete({ where: { id } });
    return true;
  }
}
