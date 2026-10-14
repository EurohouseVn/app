import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../auth/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { assertDatasetOwnership, assertDatasetStudioActor } from './dataset-studio.policy';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

type CoverageDimension = { covered: number; total: number; ratio: number };

function dimension(covered: number, total: number): CoverageDimension {
  return { covered, total, ratio: total > 0 ? covered / total : 0 };
}

export function classifyDatasetVerification(input: {
  revisionStatus: string;
  dimensions: CoverageDimension[];
  systems: number;
  verifiedFixtures: number;
  realFixtures: number;
  openIssues: number;
}) {
  const fullyCovered = input.dimensions.every((item) => item.total > 0 && item.ratio === 1);
  if (input.revisionStatus === 'RELEASED' && input.systems > 0 && input.realFixtures > 0 && input.verifiedFixtures === input.realFixtures && input.openIssues === 0 && fullyCovered) return 'VERIFIED' as const;
  if (input.revisionStatus === 'RELEASED') return 'PARTIALLY_VERIFIED' as const;
  if (input.revisionStatus === 'RETIRED') return 'RETIRED' as const;
  return 'DRAFT' as const;
}

@Injectable()
export class DatasetCoverageService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(user: JwtUser | undefined, revisionId: string) {
    assertDatasetStudioActor(user);
    const revision = await this.prisma.datasetRevision.findUnique({
      where: { id: revisionId },
      include: {
        dataset: true,
        systems: { include: { profiles: { include: { roleMappings: true } }, roleMappings: true } },
        ruleDefinitions: true,
        hardwareItems: true,
        gasketItems: true,
        glassRules: true,
        finishCompatibilities: true,
        technicalSources: { include: { links: true } },
        goldenFixtures: { include: { technicalIssues: true } },
      },
    });
    if (!revision) throw new NotFoundException('Dataset revision does not exist.');
    assertDatasetOwnership(user, revision.dataset.ownerOrganizationId);
    const links = revision.technicalSources.flatMap((source) => source.links);
    const linked = (entityType: string, id: string) => links.some((link) => link.entityType === entityType && link.entityId === id);
    const profiles = revision.systems.flatMap((system) => system.profiles);
    const mappings = revision.systems.flatMap((system) => system.roleMappings);
    const realFixtures = revision.goldenFixtures.filter((fixture) => fixture.evidenceKind === 'REAL_MANUFACTURED');
    const verifiedFixtures = realFixtures.filter((fixture) => fixture.status === 'VERIFIED');
    const dimensions = {
      profileCoverage: dimension(profiles.filter((profile) => profile.roleMappings.length > 0 && linked('PROFILE_REVISION', profile.id)).length, profiles.length),
      roleMappingCoverage: dimension(mappings.filter((mapping) => linked('PROFILE_ROLE_MAPPING', mapping.id)).length, mappings.length),
      ruleCoverage: dimension(revision.ruleDefinitions.filter((rule) => rule.reviewState === 'APPROVED').length, revision.ruleDefinitions.length),
      hardwareCoverage: dimension(revision.hardwareItems.filter((item) => linked('DATASET_HARDWARE_ITEM', item.id)).length, revision.hardwareItems.length),
      gasketCoverage: dimension(revision.gasketItems.filter((item) => linked('DATASET_GASKET_ITEM', item.id)).length, revision.gasketItems.length),
      glassRuleCoverage: dimension(revision.glassRules.filter((item) => linked('DATASET_GLASS_RULE', item.id)).length, revision.glassRules.length),
      finishCoverage: dimension(revision.finishCompatibilities.filter((item) => linked('FINISH_COMPATIBILITY', item.id)).length, revision.finishCompatibilities.length),
      goldenFixtureCoverage: dimension(verifiedFixtures.length, realFixtures.length),
      sourceCoverage: dimension(revision.technicalSources.filter((source) => source.reviewState === 'APPROVED' && source.sourceType !== 'LEGACY_DATA').length, revision.technicalSources.length),
    };
    const openIssues = realFixtures.flatMap((fixture) => fixture.technicalIssues).filter((issue) => !['RESOLVED', 'REJECTED'].includes(issue.status)).length;
    const verificationStatus = classifyDatasetVerification({
      revisionStatus: revision.status,
      dimensions: Object.values(dimensions),
      systems: revision.systems.length,
      realFixtures: realFixtures.length,
      verifiedFixtures: verifiedFixtures.length,
      openIssues,
    });
    const coverage = {
      ...dimensions,
      systems: revision.systems.length,
      realFixtures: realFixtures.length,
      verifiedFixtures: verifiedFixtures.length,
      openIssues,
      criteria: 'Full verification requires RELEASED revision, non-empty 100% dimensions, all real fixtures VERIFIED, and zero open technical issues.',
    };
    await this.prisma.$transaction([
      this.prisma.datasetRevision.update({ where: { id: revision.id }, data: { verificationStatus, verificationCoverage: json(coverage), coverageCalculatedAt: new Date() } }),
      this.prisma.materialDataset.update({ where: { id: revision.datasetId }, data: { verificationStatus } }),
    ]);
    return { revisionId: revision.id, verificationStatus, coverage };
  }
}
