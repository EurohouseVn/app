import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type TechnicalReviewState } from '@prisma/client';
import type { JwtUser } from '../../../auth/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { assertDatasetOwnership, assertDatasetStudioActor } from '../datasets/dataset-studio.policy';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export function validateRuleProvenance(input: {
  technicalSourceId?: string | null;
  technicalJustification?: string | null;
  effectiveRevision?: string | null;
}) {
  const errors: string[] = [];
  if (!input.technicalSourceId) errors.push('MISSING_TECHNICAL_SOURCE');
  if (!input.technicalJustification?.trim()) errors.push('MISSING_TECHNICAL_JUSTIFICATION');
  if (!input.effectiveRevision?.trim()) errors.push('MISSING_EFFECTIVE_REVISION');
  return errors;
}

@Injectable()
export class RuleProvenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: JwtUser | undefined, datasetRevisionId?: string) {
    assertDatasetStudioActor(user);
    return this.prisma.manufacturingRuleRecord.findMany({
      where: {
        datasetRevisionId,
        datasetRevision: user.isCeo ? undefined : { dataset: { ownerOrganizationId: user.organizationId ?? null } },
      },
      orderBy: [{ ruleId: 'asc' }, { ruleVersion: 'desc' }],
      include: { technicalSource: true, datasetRevision: { include: { dataset: true } }, fixtureUsages: { include: { goldenFixture: { select: { fixtureId: true, name: true, status: true } } } } },
    });
  }

  async create(user: JwtUser | undefined, input: {
    datasetRevisionId: string;
    technicalSourceId: string;
    ruleId: string;
    ruleVersion: string;
    purpose: string;
    inputs: unknown;
    outputSemantics: unknown;
    implementation: unknown;
    technicalJustification: string;
    effectiveRevision: string;
    systemStableKey?: string;
    constants?: unknown;
    sourceReference?: string;
  }) {
    assertDatasetStudioActor(user);
    const revision = await this.prisma.datasetRevision.findUnique({
      where: { id: input.datasetRevisionId },
      include: { dataset: true, technicalSources: { where: { id: input.technicalSourceId } } },
    });
    if (!revision) throw new NotFoundException('Dataset revision does not exist.');
    assertDatasetOwnership(user, revision.dataset.ownerOrganizationId);
    if (revision.status !== 'DRAFT') throw new BadRequestException('Rules can only be added to a DRAFT dataset revision.');
    const provenanceErrors = validateRuleProvenance(input);
    if (provenanceErrors.length) throw new BadRequestException({ message: 'Rule provenance is incomplete.', diagnostics: provenanceErrors });
    if (!revision.technicalSources.length) throw new BadRequestException('The selected technical source does not belong to this dataset revision.');
    if (!input.ruleId.trim() || !input.ruleVersion.trim() || !input.purpose.trim()) throw new BadRequestException('Rule identity and purpose are required.');

    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.manufacturingRuleRecord.create({
        data: {
          datasetRevisionId: input.datasetRevisionId,
          technicalSourceId: input.technicalSourceId,
          ruleId: input.ruleId.trim(),
          ruleVersion: input.ruleVersion.trim(),
          purpose: input.purpose.trim(),
          inputs: json(input.inputs),
          outputSemantics: json(input.outputSemantics),
          implementation: json(input.implementation),
          technicalJustification: input.technicalJustification.trim(),
          effectiveRevision: input.effectiveRevision.trim(),
          systemStableKey: input.systemStableKey?.trim() ?? '',
          constants: input.constants === undefined ? undefined : json(input.constants),
          sourceReference: input.sourceReference?.trim() ?? '',
        },
      });
      await tx.technicalReviewEvent.create({
        data: { entityType: 'MANUFACTURING_RULE', entityId: rule.id, action: 'CREATE', toStatus: 'UNREVIEWED', actorId: user.sub, notes: input.technicalJustification.trim() },
      });
      return rule;
    });
  }

  async review(user: JwtUser | undefined, id: string, input: { state: TechnicalReviewState; notes: string }) {
    assertDatasetStudioActor(user);
    const rule = await this.prisma.manufacturingRuleRecord.findUnique({
      where: { id },
      include: { datasetRevision: { include: { dataset: true } }, technicalSource: true },
    });
    if (!rule) throw new NotFoundException('Manufacturing rule does not exist.');
    if (rule.datasetRevision) assertDatasetOwnership(user, rule.datasetRevision.dataset.ownerOrganizationId);
    if (!['IN_REVIEW', 'APPROVED', 'REJECTED'].includes(input.state)) throw new BadRequestException('Unsupported rule review state.');
    if (!input.notes.trim()) throw new BadRequestException('Rule review notes are required.');
    if (input.state === 'APPROVED') {
      const errors = validateRuleProvenance(rule);
      if (errors.length || !rule.technicalSource || rule.technicalSource.reviewState !== 'APPROVED' || rule.technicalSource.sourceType === 'LEGACY_DATA') {
        throw new BadRequestException('Approval requires complete provenance and a reviewed non-legacy technical source.');
      }
    }
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.manufacturingRuleRecord.update({
        where: { id },
        data: { reviewState: input.state, reviewedById: user.sub, reviewedAt: now },
      });
      await tx.technicalReviewEvent.create({
        data: { entityType: 'MANUFACTURING_RULE', entityId: id, action: 'REVIEW', fromStatus: rule.reviewState, toStatus: input.state, actorId: user.sub, notes: input.notes.trim() },
      });
      return updated;
    });
  }

  async evidenceMatrix(user: JwtUser | undefined, datasetRevisionId?: string) {
    const rules = await this.list(user, datasetRevisionId);
    return rules.map((rule) => ({
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      system: rule.systemStableKey,
      purpose: rule.purpose,
      formula: rule.implementation,
      inputSemantics: rule.inputs,
      outputSemantics: rule.outputSemantics,
      constants: rule.constants,
      technicalSource: rule.technicalSource?.sourceDocument ?? '',
      sourceReference: rule.sourceReference || rule.technicalSource?.sourcePage || '',
      engineeringJustification: rule.technicalJustification,
      fixturesUsingRule: rule.fixtureUsages.map((usage) => usage.goldenFixture.fixtureId),
      reviewStatus: rule.reviewState,
      reviewedBy: rule.reviewedById,
      reviewedAt: rule.reviewedAt,
    }));
  }
}
