import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DifferenceClassification, Prisma } from '@prisma/client';
import type { JwtUser } from '../../../auth/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { assertDatasetOwnership, assertDatasetStudioActor } from '../datasets/dataset-studio.policy';
import { structuredDiff } from './structured-diff';
import { technicalTruthDiff } from './technical-truth-diff';

type ComparisonKind = 'LEGACY_V2' | 'DESIGN_REVISION';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export function comparisonVisibilityWhere(user: JwtUser | undefined): Prisma.CalculationComparisonWhereInput | undefined {
  assertDatasetStudioActor(user);
  return user.isCeo ? undefined : { createdById: user.sub };
}

export function assertComparisonOwnership(user: JwtUser | undefined, createdById: string): asserts user is JwtUser {
  assertDatasetStudioActor(user);
  if (!user.isCeo && createdById !== user.sub) {
    throw new NotFoundException('Calculation difference does not exist.');
  }
}

@Injectable()
export class ComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  async compare(input: {
    kind: ComparisonKind;
    fixtureId?: string;
    leftTraceId?: string;
    rightTraceId?: string;
    leftLabel: string;
    rightLabel: string;
    leftOutput: unknown;
    rightOutput: unknown;
    createdById: string;
  }) {
    const differences = structuredDiff(input.kind === 'LEGACY_V2' ? 'legacy-v2' : 'design-revision', input.leftOutput, input.rightOutput);
    const status = differences.some((item) => item.classification === 'UNEXPLAINED_DIFFERENCE')
      ? 'UNEXPLAINED_DIFFERENCE'
      : differences.some((item) => item.classification === 'NOT_COMPARABLE')
        ? 'NOT_COMPARABLE'
        : 'MATCH';
    return this.prisma.calculationComparison.create({
      data: {
        kind: input.kind,
        fixtureId: input.fixtureId,
        leftTraceId: input.leftTraceId,
        rightTraceId: input.rightTraceId,
        leftLabel: input.leftLabel,
        rightLabel: input.rightLabel,
        leftOutput: json(input.leftOutput),
        rightOutput: json(input.rightOutput),
        status,
        summary: json({ total: differences.length, unexplained: differences.filter((item) => item.classification === 'UNEXPLAINED_DIFFERENCE').length }),
        createdById: input.createdById,
        differences: {
          create: differences.map((item) => ({
            entity: item.entity,
            field: item.field,
            legacyValue: item.legacyValue === undefined ? undefined : json(item.legacyValue),
            v2Value: item.v2Value === undefined ? undefined : json(item.v2Value),
            delta: item.delta === undefined ? undefined : json(item.delta),
            classification: item.classification,
            reason: item.reason,
          })),
        },
      },
      include: { differences: true },
    });
  }

  list(user: JwtUser | undefined) {
    return this.prisma.calculationComparison.findMany({
      where: comparisonVisibilityWhere(user),
      orderBy: { createdAt: 'desc' },
      include: {
        fixture: { select: { fixtureId: true, name: true } },
        expectedOutputRevision: { select: { id: true, revisionNumber: true, status: true, contentHash: true } },
        differences: { include: { technicalIssue: true } },
      },
      take: 100,
    });
  }

  async reviewDifference(id: string, user: JwtUser | undefined, input: { classification: DifferenceClassification; reason: string; source: string }) {
    const difference = await this.prisma.calculationDifference.findUnique({ where: { id }, include: { comparison: { select: { createdById: true } } } });
    if (!difference) throw new NotFoundException('Calculation difference does not exist.');
    assertComparisonOwnership(user, difference.comparison.createdById);
    const comparison = await this.prisma.calculationComparison.findUnique({ where: { id: difference.comparisonId }, select: { kind: true } });
    if (comparison?.kind === 'TECHNICAL_TRUTH_THREE_WAY') throw new BadRequestException('Technical truth classifications cannot be manually overwritten. Resolve the rule/data issue and recalculate.');
    if (input.classification === 'EXPLAINED_DIFFERENCE' && (!input.reason.trim() || !input.source.trim())) {
      throw new BadRequestException('An explained difference requires both reason and technical source.');
    }
    await this.prisma.calculationDifference.update({
      where: { id },
      data: {
        classification: input.classification,
        reason: input.reason.trim(),
        source: input.source.trim(),
        reviewStatus: 'REVIEWED',
        reviewedById: user.sub,
        reviewedAt: new Date(),
      },
    });
    return this.refreshStatus(difference.comparisonId);
  }

  async compareTechnicalTruth(user: JwtUser | undefined, input: {
    fixtureId: string;
    expectedOutputRevisionId: string;
    legacyOutput: unknown;
    v2Output: unknown;
    leftTraceId?: string;
    rightTraceId?: string;
  }) {
    assertDatasetStudioActor(user);
    const expected = await this.prisma.expectedOutputRevision.findUnique({
      where: { id: input.expectedOutputRevisionId },
      include: { goldenFixture: true, datasetRevision: { include: { dataset: true } }, technicalSource: true },
    });
    if (!expected || expected.goldenFixtureId !== input.fixtureId) throw new NotFoundException('Approved expected output does not belong to this fixture.');
    assertDatasetOwnership(user, expected.datasetRevision.dataset.ownerOrganizationId);
    if (expected.status !== 'APPROVED' || expected.technicalSource.reviewState !== 'APPROVED') throw new BadRequestException('Three-way comparison requires approved expected output and technical source.');
    const differences = technicalTruthDiff('technical-truth', expected.output, input.legacyOutput, input.v2Output);
    const status = differences.some((item) => ['LEGACY_MATCH_TECHNICAL', 'BOTH_DIFFER'].includes(item.classification))
      ? 'UNEXPLAINED_DIFFERENCE'
      : differences.some((item) => ['NOT_COMPARABLE', 'MISSING_TECHNICAL_TRUTH'].includes(item.classification))
        ? 'NOT_COMPARABLE'
        : 'MATCH';
    return this.prisma.$transaction(async (tx) => {
      const comparison = await tx.calculationComparison.create({
        data: {
          kind: 'TECHNICAL_TRUTH_THREE_WAY',
          fixtureId: input.fixtureId,
          expectedOutputRevisionId: expected.id,
          leftTraceId: input.leftTraceId,
          rightTraceId: input.rightTraceId,
          leftLabel: 'Legacy calculation',
          rightLabel: 'V2 calculation',
          leftOutput: json(input.legacyOutput),
          rightOutput: json(input.v2Output),
          technicalTruthOutput: json(expected.output),
          status,
          summary: json({ total: differences.length, blocking: differences.filter((item) => ['LEGACY_MATCH_TECHNICAL', 'BOTH_DIFFER', 'NOT_COMPARABLE', 'MISSING_TECHNICAL_TRUTH'].includes(item.classification)).length }),
          createdById: user.sub,
          differences: {
            create: differences.map((item) => ({
              entity: item.entity,
              field: item.field,
              approvedExpected: item.approvedExpected === undefined ? undefined : json(item.approvedExpected),
              legacyValue: item.legacyValue === undefined ? undefined : json(item.legacyValue),
              v2Value: item.v2Value === undefined ? undefined : json(item.v2Value),
              delta: item.delta === undefined ? undefined : json(item.delta),
              classification: item.classification,
              reason: item.reason,
              technicalSourceId: expected.technicalSourceId,
            })),
          },
        },
        include: { differences: true },
      });
      const blockers = comparison.differences.filter((item) => ['LEGACY_MATCH_TECHNICAL', 'BOTH_DIFFER', 'NOT_COMPARABLE', 'MISSING_TECHNICAL_TRUTH'].includes(item.classification));
      if (blockers.length) {
        await tx.manufacturingTechnicalIssue.createMany({
          data: blockers.map((item) => ({
            fixtureId: input.fixtureId,
            differenceId: item.id,
            technicalSourceId: expected.technicalSourceId,
            title: `${item.classification}: ${item.field}`,
            description: item.reason,
            openedById: user.sub,
          })),
        });
      }
      return comparison;
    });
  }

  async resolveTechnicalDifference(id: string, user: JwtUser | undefined, input: {
    resolution: string;
    technicalSourceId: string;
    responsibleRuleId?: string;
    responsibleDatasetItem?: string;
    resolved?: boolean;
  }) {
    const difference = await this.prisma.calculationDifference.findUnique({
      where: { id },
      include: { comparison: { select: { createdById: true, kind: true } }, technicalIssue: true },
    });
    if (!difference) throw new NotFoundException('Calculation difference does not exist.');
    assertComparisonOwnership(user, difference.comparison.createdById);
    if (difference.comparison.kind !== 'TECHNICAL_TRUTH_THREE_WAY') throw new BadRequestException('This endpoint only resolves technical-truth differences.');
    if (!input.resolution.trim() || !input.technicalSourceId.trim()) throw new BadRequestException('Resolution and technical source are required.');
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.calculationDifference.update({
        where: { id },
        data: {
          resolution: input.resolution.trim(),
          technicalSourceId: input.technicalSourceId,
          responsibleRuleId: input.responsibleRuleId,
          responsibleDatasetItem: input.responsibleDatasetItem?.trim() ?? '',
          reviewStatus: 'REVIEWED',
          reviewedById: user.sub,
          reviewedAt: now,
          resolvedById: input.resolved ? user.sub : null,
          resolvedAt: input.resolved ? now : null,
        },
      });
      if (difference.technicalIssue) {
        await tx.manufacturingTechnicalIssue.update({
          where: { id: difference.technicalIssue.id },
          data: {
            status: input.resolved ? 'RESOLVED' : 'IN_REVIEW',
            resolution: input.resolution.trim(),
            technicalSourceId: input.technicalSourceId,
            responsibleRuleId: input.responsibleRuleId,
            responsibleDatasetItem: input.responsibleDatasetItem?.trim() ?? '',
            resolvedById: input.resolved ? user.sub : null,
            resolvedAt: input.resolved ? now : null,
          },
        });
      }
      return updated;
    });
  }

  private async refreshStatus(comparisonId: string) {
    const comparison = await this.prisma.calculationComparison.findUnique({ where: { id: comparisonId }, include: { differences: true } });
    if (!comparison) throw new NotFoundException('Calculation comparison does not exist.');
    const status = comparison.differences.some((item) => item.classification === 'UNEXPLAINED_DIFFERENCE')
      ? 'UNEXPLAINED_DIFFERENCE'
      : comparison.differences.some((item) => item.classification === 'NOT_COMPARABLE')
        ? 'NOT_COMPARABLE'
        : comparison.differences.some((item) => item.classification === 'EXPLAINED_DIFFERENCE')
          ? 'EXPLAINED_DIFFERENCE'
          : 'MATCH';
    return this.prisma.calculationComparison.update({ where: { id: comparisonId }, data: { status }, include: { differences: true } });
  }
}
