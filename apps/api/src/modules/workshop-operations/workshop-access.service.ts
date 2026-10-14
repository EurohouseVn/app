import { Injectable, NotFoundException } from '@nestjs/common';
import type { WorkshopWorkspaceRole } from '@prisma/client';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertWorkspaceCapability,
  organizationScope,
  type WorkshopCapability,
  type WorkshopWorkspaceRoleName,
  workspaceCapabilities,
} from './workshop-operations.rules';

@Injectable()
export class WorkshopAccessService {
  constructor(private readonly prisma: PrismaService) {}

  organization(user: JwtUser, requestedOrganizationId?: string) {
    return organizationScope(user, requestedOrganizationId);
  }

  async role(user: JwtUser, organizationId: string): Promise<WorkshopWorkspaceRoleName> {
    if (user.isCeo || user.role === 'ADMIN') return 'ADMIN';
    const assignment = await this.prisma.workshopRoleAssignment.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.sub } },
    });
    if (assignment?.active) return assignment.role as WorkshopWorkspaceRoleName;
    if (user.role === 'FACTORY' || user.role === 'DAILY') return 'OWNER';
    return 'WORKER';
  }

  async assert(user: JwtUser, organizationId: string, capability: WorkshopCapability) {
    const role = await this.role(user, organizationId);
    assertWorkspaceCapability(role, capability);
    return role;
  }

  async workspace(user: JwtUser, requestedOrganizationId?: string) {
    const organizationId = this.organization(user, requestedOrganizationId);
    const role = await this.role(user, organizationId);
    const primarySurface: Record<WorkshopWorkspaceRoleName, string> = {
      ADMIN: 'OPERATIONS_DASHBOARD',
      OWNER: 'OPERATIONS_DASHBOARD',
      WORKSHOP_MANAGER: 'OPERATIONS_DASHBOARD',
      SUPERVISOR: 'WORKSHOP_STATUS',
      WORKER: 'MY_WORK_TODAY',
      INSTALLER: 'INSTALLATIONS_TODAY',
    };
    return { organizationId, role, primarySurface: primarySurface[role], capabilities: workspaceCapabilities(role) };
  }

  async assign(
    actor: JwtUser,
    input: { organizationId?: string; userId: string; role: WorkshopWorkspaceRole; active?: boolean },
  ) {
    const organizationId = this.organization(actor, input.organizationId);
    await this.assert(actor, organizationId, 'master.manage');
    const target = await this.prisma.user.findFirst({ where: { id: input.userId, organizationId } });
    if (!target) throw new NotFoundException('Không tìm thấy người dùng trong tổ chức này.');
    return this.prisma.workshopRoleAssignment.upsert({
      where: { organizationId_userId: { organizationId, userId: input.userId } },
      create: { organizationId, userId: input.userId, role: input.role, active: input.active !== false, assignedById: actor.sub },
      update: { role: input.role, active: input.active !== false, assignedById: actor.sub },
    });
  }
}
