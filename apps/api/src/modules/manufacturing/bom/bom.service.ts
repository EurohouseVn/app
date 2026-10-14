import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { BomMaterialCategory, Prisma } from '@prisma/client';
import type { ResolvedMaterialRequirement } from '../datasets/dataset-resolver';

export type BomLine = ResolvedMaterialRequirement & { description: string };

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export function assertBomRevisionMutableStatus(status: string) {
  if (status === 'RELEASED' || status === 'SUPERSEDED') {
    throw new BadRequestException('Released BOM revisions are immutable. Create a new revision.');
  }
}

export function assertBomTransition(status: string, action: 'CALCULATE' | 'SUBMIT_REVIEW' | 'APPROVE' | 'RELEASE') {
  const expected = {
    CALCULATE: ['DRAFT'],
    SUBMIT_REVIEW: ['CALCULATED'],
    APPROVE: ['TECHNICAL_REVIEW'],
    RELEASE: ['APPROVED'],
  }[action];
  if (!expected.includes(status)) {
    throw new BadRequestException(`BOM transition ${action} is not allowed from ${status}.`);
  }
}

@Injectable()
export class BomService {
  constructor(private readonly prisma: PrismaService) {}

  toLines(requirements: ResolvedMaterialRequirement[]): BomLine[] {
    return requirements.map((item) => ({
      ...item,
      description: item.materialCode
        ? `${item.materialCode} / ${item.role}`
        : `${item.category} / ${item.role}`,
    }));
  }

  async createDraft(input: {
    stableKey: string;
    doorDesignRevisionId: string;
    ownerOrganizationId?: string;
    datasetRevisionId: string;
    calculationTraceId?: string;
    engineVersion: string;
    rulePackVersion: string;
    priceBookVersion?: string;
    lineage: Record<string, unknown>;
    lines: BomLine[];
  }) {
    const existing = await this.prisma.bom.findUnique({
      where: { stableKey: input.stableKey },
      include: { revisions: { orderBy: { revisionNumber: 'desc' }, take: 1 } },
    });
    const revisionNumber = (existing?.revisions[0]?.revisionNumber ?? 0) + 1;
    return this.prisma.bom.upsert({
      where: { stableKey: input.stableKey },
      create: {
        stableKey: input.stableKey,
        doorDesignRevisionId: input.doorDesignRevisionId,
        ownerOrganizationId: input.ownerOrganizationId,
        revisions: { create: this.revisionData(input, revisionNumber) },
      },
      update: { revisions: { create: this.revisionData(input, revisionNumber) } },
      include: { revisions: { orderBy: { revisionNumber: 'desc' }, take: 1, include: { items: true } } },
    });
  }

  async release(revisionId: string) {
    const revision = await this.prisma.bomRevision.findUnique({ where: { id: revisionId } });
    if (!revision) throw new NotFoundException('BOM revision does not exist.');
    if (revision.status === 'RELEASED') return revision;
    if (revision.status !== 'DRAFT' && revision.status !== 'VALIDATED') {
      throw new BadRequestException('Only a draft or validated BOM can be released.');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.bomRevision.updateMany({
        where: { bomId: revision.bomId, status: 'RELEASED', id: { not: revision.id } },
        data: { status: 'SUPERSEDED' },
      });
      return tx.bomRevision.update({
        where: { id: revision.id },
        data: { status: 'RELEASED', releasedAt: new Date() },
      });
    });
  }

  async markCalculated(revisionId: string, actorId: string, notes = '') {
    return this.transition(revisionId, 'CALCULATE', 'CALCULATED', actorId, notes);
  }

  async submitTechnicalReview(revisionId: string, actorId: string, notes: string) {
    if (!notes.trim()) throw new BadRequestException('Technical review notes are required.');
    return this.transition(revisionId, 'SUBMIT_REVIEW', 'TECHNICAL_REVIEW', actorId, notes);
  }

  async approve(revisionId: string, actorId: string, notes: string) {
    if (!notes.trim()) throw new BadRequestException('BOM approval notes are required.');
    const revision = await this.getRevision(revisionId);
    assertBomTransition(revision.status, 'APPROVE');
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.bomRevision.update({
        where: { id: revisionId },
        data: { status: 'APPROVED', approvedById: actorId, approvedAt: now, reviewNotes: notes.trim() },
        include: { items: true },
      });
      await this.audit(tx, revisionId, 'APPROVE', revision.status, 'APPROVED', actorId, notes);
      return updated;
    });
  }

  async releaseReviewed(revisionId: string, actorId: string, notes: string) {
    const revision = await this.getRevision(revisionId);
    assertBomTransition(revision.status, 'RELEASE');
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.bomRevision.updateMany({
        where: { bomId: revision.bomId, status: 'RELEASED', id: { not: revision.id } },
        data: { status: 'SUPERSEDED' },
      });
      const updated = await tx.bomRevision.update({
        where: { id: revision.id },
        data: { status: 'RELEASED', releasedById: actorId, releasedAt: now },
        include: { items: true },
      });
      await this.audit(tx, revisionId, 'RELEASE', revision.status, 'RELEASED', actorId, notes);
      return updated;
    });
  }

  async assertMutable(revisionId: string) {
    const revision = await this.prisma.bomRevision.findUnique({ where: { id: revisionId }, select: { status: true } });
    if (!revision) throw new NotFoundException('BOM revision does not exist.');
    assertBomRevisionMutableStatus(revision.status);
  }

  private async transition(
    revisionId: string,
    action: 'CALCULATE' | 'SUBMIT_REVIEW',
    toStatus: 'CALCULATED' | 'TECHNICAL_REVIEW',
    actorId: string,
    notes: string,
  ) {
    const revision = await this.getRevision(revisionId);
    assertBomTransition(revision.status, action);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.bomRevision.update({
        where: { id: revisionId },
        data: toStatus === 'TECHNICAL_REVIEW'
          ? { status: toStatus, reviewedById: actorId, reviewedAt: now, reviewNotes: notes.trim() }
          : { status: toStatus },
        include: { items: true },
      });
      await this.audit(tx, revisionId, action, revision.status, toStatus, actorId, notes);
      return updated;
    });
  }

  private async getRevision(revisionId: string) {
    const revision = await this.prisma.bomRevision.findUnique({ where: { id: revisionId } });
    if (!revision) throw new NotFoundException('BOM revision does not exist.');
    return revision;
  }

  private audit(
    tx: Prisma.TransactionClient,
    entityId: string,
    action: string,
    fromStatus: string,
    toStatus: string,
    actorId: string,
    notes: string,
  ) {
    return tx.technicalReviewEvent.create({
      data: { entityType: 'BOM_REVISION', entityId, action, fromStatus, toStatus, actorId, notes: notes.trim() },
    });
  }

  private revisionData(input: Parameters<BomService['createDraft']>[0], revisionNumber: number) {
    return {
      revisionNumber,
      datasetRevisionId: input.datasetRevisionId,
      calculationTraceId: input.calculationTraceId,
      engineVersion: input.engineVersion,
      rulePackVersion: input.rulePackVersion,
      priceBookVersion: input.priceBookVersion,
      lineage: json(input.lineage),
      items: {
        create: input.lines.map((line) => ({
          category: line.category as BomMaterialCategory,
          roleCode: line.role,
          componentId: line.componentId,
          profileRevisionId: line.profileRevisionId,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          lengthMm: line.lengthMm,
          widthMm: line.widthMm,
          heightMm: line.heightMm,
          attributes: json(line.attributes),
          constraints: json(line.constraints),
          sourceRule: line.sourceRule,
          trace: json({ requirementId: line.id }),
        })),
      },
    };
  }
}
