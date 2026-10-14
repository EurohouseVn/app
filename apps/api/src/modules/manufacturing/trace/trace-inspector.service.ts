import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../auth/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { assertDatasetStudioActor } from '../datasets/dataset-studio.policy';

@Injectable()
export class TraceInspectorService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: JwtUser | undefined) {
    assertDatasetStudioActor(user);
    return this.prisma.calculationTrace.findMany({
      where: user.isCeo ? undefined : { doorDesignRevision: { doorDesign: { ownerOrganizationId: user.organizationId ?? null } } },
      orderBy: { completedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        executionId: true,
        engineVersion: true,
        rulePackVersion: true,
        startedAt: true,
        completedAt: true,
        doorDesignRevision: { select: { id: true, revisionNumber: true, doorDesign: { select: { code: true, name: true } } } },
        datasetRevision: { select: { id: true, versionTag: true, status: true, dataset: { select: { name: true } } } },
        _count: { select: { steps: true, bomRevisions: true } },
      },
    });
  }

  async detail(user: JwtUser | undefined, id: string) {
    assertDatasetStudioActor(user);
    const trace = await this.prisma.calculationTrace.findFirst({
      where: { id, ...(user.isCeo ? {} : { doorDesignRevision: { doorDesign: { ownerOrganizationId: user.organizationId ?? null } } }) },
      include: {
        steps: { orderBy: { sequence: 'asc' } },
        doorDesignRevision: { include: { doorDesign: true } },
        datasetRevision: { include: { dataset: { include: { manufacturer: true } }, technicalSources: true, ruleDefinitions: { include: { technicalSource: true } } } },
        bomRevisions: { include: { items: true }, orderBy: { revisionNumber: 'desc' } },
        comparisonsAsLeft: { include: { differences: true } },
        comparisonsAsRight: { include: { differences: true } },
      },
    });
    if (!trace) throw new NotFoundException('Calculation trace does not exist or is outside your organization.');
    return trace;
  }
}
