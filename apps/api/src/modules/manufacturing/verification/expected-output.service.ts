import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../auth/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { assertDatasetOwnership, assertDatasetStudioActor } from '../datasets/dataset-studio.policy';
import { versionIdentity } from '../rules/version-identity';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const expectedArraySections = ['profiles', 'quantities', 'cuttingLengths', 'cuttingAngles', 'machining', 'glass', 'gaskets', 'hardware', 'accessories', 'bom', 'cuttingRequirements'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateManualExpectedOutput(value: unknown): string[] {
  if (!isRecord(value)) return ['EXPECTED_OUTPUT_MUST_BE_AN_OBJECT'];
  const errors: string[] = [];
  if (!isRecord(value.topology)) errors.push('EXPECTED_TOPOLOGY_REQUIRED');
  if (!isRecord(value.applicability)) errors.push('EXPECTED_APPLICABILITY_REQUIRED');
  if (!isRecord(value.notApplicableReasons)) errors.push('NOT_APPLICABLE_REASONS_REQUIRED');
  for (const section of expectedArraySections) {
    if (!Array.isArray(value[section])) {
      errors.push(`EXPECTED_${section.toUpperCase()}_MUST_BE_AN_ARRAY`);
      continue;
    }
    const applicable = isRecord(value.applicability) ? value.applicability[section] : undefined;
    if (typeof applicable !== 'boolean') errors.push(`APPLICABILITY_${section.toUpperCase()}_REQUIRED`);
    if (applicable === true && value[section].length === 0) errors.push(`EXPECTED_${section.toUpperCase()}_REQUIRED`);
    const reason = isRecord(value.notApplicableReasons) ? value.notApplicableReasons[section] : undefined;
    if (applicable === false && (typeof reason !== 'string' || !reason.trim())) errors.push(`NOT_APPLICABLE_REASON_${section.toUpperCase()}_REQUIRED`);
  }
  return errors;
}

export function assertExpectedOutputMutable(status: string) {
  if (status !== 'DRAFT') throw new BadRequestException('Reviewed or approved expected output is immutable. Create a new revision.');
}

@Injectable()
export class ExpectedOutputService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: JwtUser | undefined, fixtureId: string) {
    const fixture = await this.fixture(user, fixtureId);
    return this.prisma.expectedOutputRevision.findMany({
      where: { goldenFixtureId: fixture.id },
      orderBy: { revisionNumber: 'desc' },
      include: { technicalSource: true, datasetRevision: { select: { id: true, versionTag: true, status: true } } },
    });
  }

  async create(user: JwtUser | undefined, fixtureId: string, input: {
    output: unknown;
    technicalSourceId: string;
    datasetRevisionId: string;
    technicalNotes: string;
    ruleRecordIds?: string[];
  }) {
    const fixture = await this.fixture(user, fixtureId);
    if (fixture.evidenceKind !== 'REAL_MANUFACTURED') throw new BadRequestException('Synthetic candidates cannot receive approved expected manufacturing output.');
    if (fixture.status === 'VERIFIED') throw new BadRequestException('A VERIFIED fixture is frozen. Create a replacement fixture or a new fixture version.');
    const errors = validateManualExpectedOutput(input.output);
    if (errors.length) throw new BadRequestException({ message: 'Manual expected output is incomplete.', diagnostics: errors });
    if (!input.technicalNotes.trim()) throw new BadRequestException('Technical notes are required.');
    const [source, revision, last] = await Promise.all([
      this.prisma.technicalSource.findUnique({ where: { id: input.technicalSourceId } }),
      this.prisma.datasetRevision.findUnique({ where: { id: input.datasetRevisionId }, include: { dataset: true } }),
      this.prisma.expectedOutputRevision.findFirst({ where: { goldenFixtureId: fixture.id }, orderBy: { revisionNumber: 'desc' } }),
    ]);
    if (!source) throw new NotFoundException('Technical source does not exist.');
    if (!revision) throw new NotFoundException('Dataset revision does not exist.');
    assertDatasetOwnership(user!, revision.dataset.ownerOrganizationId);
    if (fixture.datasetRevisionId && fixture.datasetRevisionId !== revision.id) throw new BadRequestException('Expected output must use the fixture dataset revision.');
    if (source.datasetRevisionId && source.datasetRevisionId !== revision.id) throw new BadRequestException('Technical source belongs to another dataset revision.');
    const ruleRecordIds = [...new Set(input.ruleRecordIds ?? [])];
    const ruleCount = ruleRecordIds.length ? await this.prisma.manufacturingRuleRecord.count({ where: { id: { in: ruleRecordIds }, datasetRevisionId: revision.id } }) : 0;
    if (ruleCount !== ruleRecordIds.length) throw new BadRequestException('One or more fixture rules do not belong to the selected dataset revision.');
    return this.prisma.$transaction(async (tx) => {
      const expected = await tx.expectedOutputRevision.create({
        data: {
          goldenFixtureId: fixture.id,
          revisionNumber: (last?.revisionNumber ?? 0) + 1,
          output: json(input.output),
          technicalSourceId: source.id,
          datasetRevisionId: revision.id,
          enteredById: user!.sub,
          technicalNotes: input.technicalNotes.trim(),
        },
      });
      if (ruleRecordIds.length) {
        await tx.goldenFixtureRuleUsage.createMany({ data: ruleRecordIds.map((ruleRecordId) => ({ goldenFixtureId: fixture.id, ruleRecordId })) , skipDuplicates: true });
      }
      await tx.goldenFixture.update({ where: { id: fixture.id }, data: { technicalSourceId: source.id, datasetRevisionId: revision.id } });
      await this.audit(tx, expected.id, 'CREATE', '', 'DRAFT', user!.sub, input.technicalNotes);
      return expected;
    });
  }

  async submitReview(user: JwtUser | undefined, id: string, notes: string) {
    const expected = await this.expected(user, id);
    assertExpectedOutputMutable(expected.status);
    const errors = validateManualExpectedOutput(expected.output);
    if (errors.length) throw new BadRequestException({ message: 'Manual expected output is incomplete.', diagnostics: errors });
    if (!notes.trim()) throw new BadRequestException('Expected output review notes are required.');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.expectedOutputRevision.update({ where: { id }, data: { status: 'REVIEW', reviewedById: user!.sub, reviewedAt: new Date(), reviewNotes: notes.trim() } });
      await this.audit(tx, id, 'SUBMIT_REVIEW', 'DRAFT', 'REVIEW', user!.sub, notes);
      return updated;
    });
  }

  async approve(user: JwtUser | undefined, id: string, notes: string) {
    const expected = await this.expected(user, id);
    if (expected.status !== 'REVIEW') throw new BadRequestException('Only expected output in REVIEW can be approved.');
    if (expected.technicalSource.reviewState !== 'APPROVED' || expected.technicalSource.sourceType === 'LEGACY_DATA') throw new BadRequestException('Approval requires an approved non-legacy technical source.');
    if (expected.datasetRevision.status !== 'RELEASED') throw new BadRequestException('Approval requires a RELEASED dataset revision.');
    if (!notes.trim()) throw new BadRequestException('Expected output approval notes are required.');
    const contentHash = versionIdentity('approved-expected-output', expected.output);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.expectedOutputRevision.updateMany({ where: { goldenFixtureId: expected.goldenFixtureId, status: 'APPROVED', id: { not: id } }, data: { status: 'SUPERSEDED' } });
      const updated = await tx.expectedOutputRevision.update({ where: { id }, data: { status: 'APPROVED', approvedById: user!.sub, approvedAt: now, contentHash, reviewNotes: notes.trim() } });
      await this.audit(tx, id, 'APPROVE', 'REVIEW', 'APPROVED', user!.sub, notes, { contentHash });
      return updated;
    });
  }

  private async fixture(user: JwtUser | undefined, id: string) {
    assertDatasetStudioActor(user);
    const fixture = await this.prisma.goldenFixture.findUnique({ where: { id }, include: { datasetRevision: { include: { dataset: true } } } });
    if (!fixture) throw new NotFoundException('Golden fixture does not exist.');
    if (fixture.datasetRevision) assertDatasetOwnership(user, fixture.datasetRevision.dataset.ownerOrganizationId);
    return fixture;
  }

  private async expected(user: JwtUser | undefined, id: string) {
    assertDatasetStudioActor(user);
    const expected = await this.prisma.expectedOutputRevision.findUnique({
      where: { id },
      include: { technicalSource: true, datasetRevision: { include: { dataset: true } }, goldenFixture: true },
    });
    if (!expected) throw new NotFoundException('Expected output revision does not exist.');
    assertDatasetOwnership(user, expected.datasetRevision.dataset.ownerOrganizationId);
    return expected;
  }

  private audit(tx: Prisma.TransactionClient, entityId: string, action: string, fromStatus: string, toStatus: string, actorId: string, notes: string, metadata?: unknown) {
    return tx.technicalReviewEvent.create({ data: { entityType: 'EXPECTED_OUTPUT_REVISION', entityId, action, fromStatus, toStatus, actorId, notes: notes.trim(), metadata: metadata === undefined ? undefined : json(metadata) } });
  }
}
