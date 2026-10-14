import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../auth/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { BomService } from '../bom/bom.service';
import { ComparisonService } from '../comparison/comparison.service';
import { CuttingEngine } from '../cutting/cutting-engine';
import { assertDatasetOwnership, assertDatasetStudioActor } from '../datasets/dataset-studio.policy';
import { DatasetResolver } from '../datasets/dataset-resolver';
import type { CanonicalDoorDesignRevision, GeometryBox } from '../design/door-design.types';
import { CANDIDATE_GOLDEN_FIXTURES } from '../golden-fixtures';
import { CanonicalRuleEngine } from '../rules/canonical-rule-engine';
import { CalculationTraceService } from '../trace/calculation-trace.service';
import { assertGoldenFixtureApproval } from './golden-fixture.policy';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export function validateRealFixtureIdentity(topology: unknown): string[] {
  if (!topology || typeof topology !== 'object' || Array.isArray(topology)) return ['FIXTURE_TOPOLOGY_REQUIRED'];
  const value = topology as Record<string, unknown>;
  const required = ['openingMechanism', 'leafCount', 'fixedPanels', 'mullionTransomArrangement', 'glassConfiguration', 'hardwareConfiguration'];
  return required.filter((key) => value[key] === undefined || value[key] === null || value[key] === '').map((key) => `FIXTURE_IDENTITY_${key.toUpperCase()}_REQUIRED`);
}

export type FrozenGoldenRegressionInput = {
  fixtureId: string;
  name: string;
  doorDesignRevisionId: string | null;
  datasetRevisionId: string | null;
  ruleVersion: string;
  engineVersion: string;
  verifiedExpectedOutputRevisionId: string | null;
  verifiedExpectedOutputRevision: { revisionNumber: number; contentHash: string; output: unknown } | null;
};

export function buildFrozenGoldenRegressionCase(fixture: FrozenGoldenRegressionInput) {
  if (!fixture.doorDesignRevisionId || !fixture.datasetRevisionId || !fixture.verifiedExpectedOutputRevisionId || !fixture.verifiedExpectedOutputRevision) {
    throw new BadRequestException('VERIFIED_FIXTURE_HAS_INCOMPLETE_REGRESSION_PINS');
  }
  if (!fixture.ruleVersion || !fixture.engineVersion) throw new BadRequestException('VERIFIED_FIXTURE_HAS_INCOMPLETE_ENGINE_PINS');
  return {
    fixtureId: fixture.fixtureId,
    fixtureName: fixture.name,
    doorDesignRevisionId: fixture.doorDesignRevisionId,
    datasetRevisionId: fixture.datasetRevisionId,
    rulePackVersion: fixture.ruleVersion,
    engineVersion: fixture.engineVersion,
    expectedOutputRevisionId: fixture.verifiedExpectedOutputRevisionId,
    expectedOutputRevisionNumber: fixture.verifiedExpectedOutputRevision.revisionNumber,
    expectedOutputContentHash: fixture.verifiedExpectedOutputRevision.contentHash,
    expectedOutput: fixture.verifiedExpectedOutputRevision.output,
  };
}

@Injectable()
export class GoldenFixtureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: CanonicalRuleEngine,
    private readonly resolver: DatasetResolver,
    private readonly bom: BomService,
    private readonly cutting: CuttingEngine,
    private readonly traces: CalculationTraceService,
    private readonly comparisons: ComparisonService,
  ) {}

  async list(user: JwtUser | undefined) {
    assertDatasetStudioActor(user);
    return this.prisma.goldenFixture.findMany({
      where: user.isCeo ? undefined : { datasetRevision: { dataset: { ownerOrganizationId: user.organizationId ?? null } } },
      orderBy: { fixtureId: 'asc' },
      include: {
        datasetRevision: { select: { id: true, versionTag: true, status: true } },
        technicalSource: true,
        expectedOutputRevisions: { orderBy: { revisionNumber: 'desc' } },
        ruleUsages: { include: { ruleRecord: true } },
        technicalIssues: { orderBy: { createdAt: 'desc' } },
        comparisons: { select: { id: true, kind: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async bootstrapCandidates(user: JwtUser | undefined) {
    assertDatasetStudioActor(user);
    const created = [];
    for (const design of CANDIDATE_GOLDEN_FIXTURES) {
      const fixtureId = `phase1-candidate:${design.id}`;
      const candidate = await this.prisma.goldenFixture.upsert({
        where: { fixtureId },
        update: {},
        create: {
          fixtureId,
          name: `${design.category} ${design.widthMm}x${design.heightMm} - candidate`,
          doorWindowType: design.category,
          systemStableKey: 'UNRESOLVED',
          dimensions: json({ widthMm: design.widthMm, heightMm: design.heightMm }),
          openingTopology: json({ openingType: design.openingType, leafCount: design.leafCount, handing: design.handing, openingDirection: design.openingDirection }),
          profileRoleMapping: json({ unresolved: true }),
          expectedProfileIdentities: json([]),
          expectedCuttingLengths: json([]),
          expectedCuttingAngles: json([]),
          expectedGlass: json([]),
          expectedGasket: json([]),
          expectedHardware: json([]),
          expectedAccessories: json([]),
          expectedBom: json([]),
          expectedCuttingRequirements: json([]),
          candidateDesign: json(design),
          notes: 'Provisional Phase 0 topology only. Technical outputs and Eurohouse system mapping require explicit review; this is not verified manufacturing data.',
        },
      });
      created.push(candidate);
    }
    return { total: created.length, fixtures: created };
  }

  async regressionManifest(user: JwtUser | undefined) {
    assertDatasetStudioActor(user);
    const fixtures = await this.prisma.goldenFixture.findMany({
      where: {
        status: 'VERIFIED',
        ...(user.isCeo ? {} : { datasetRevision: { dataset: { ownerOrganizationId: user.organizationId ?? null } } }),
      },
      orderBy: { fixtureId: 'asc' },
      include: { verifiedExpectedOutputRevision: true },
    });
    return {
      immutable: true,
      expectedOutputUpdatePolicy: 'NEW_TECHNICAL_APPROVAL_AND_REVISION_REQUIRED',
      cases: fixtures.map(buildFrozenGoldenRegressionCase),
    };
  }

  async create(user: JwtUser | undefined, input: {
    fixtureId: string;
    name: string;
    doorDesignRevisionId: string;
    datasetRevisionId: string;
    technicalSourceId: string;
    doorWindowType: string;
    systemStableKey: string;
    dimensions: unknown;
    openingTopology: unknown;
    referenceImageObjectId?: string;
    profileRoleMapping: unknown;
    expectedProfileIdentities: unknown;
    expectedCuttingLengths: unknown;
    expectedCuttingAngles: unknown;
    expectedGlass: unknown;
    expectedGasket: unknown;
    expectedHardware: unknown;
    expectedAccessories: unknown;
    expectedBom: unknown;
    expectedCuttingRequirements: unknown;
    candidateDesign: unknown;
    notes?: string;
    evidenceKind: 'SYNTHETIC_CANDIDATE' | 'REAL_MANUFACTURED';
  }) {
    assertDatasetStudioActor(user);
    const dataset = await this.prisma.datasetRevision.findUnique({ where: { id: input.datasetRevisionId }, include: { dataset: true, technicalSources: true } });
    if (!dataset) throw new NotFoundException('Dataset revision does not exist.');
    assertDatasetOwnership(user, dataset.dataset.ownerOrganizationId);
    if (!dataset.technicalSources.some((source) => source.id === input.technicalSourceId)) throw new BadRequestException('Fixture source must belong to the selected dataset revision.');
    const design = await this.prisma.doorDesignRevision.findUnique({ where: { id: input.doorDesignRevisionId } });
    if (!design) throw new NotFoundException('Door design revision does not exist.');
    if (!input.fixtureId.trim() || !input.name.trim() || !input.systemStableKey.trim()) throw new BadRequestException('Fixture identity, name, and system are required.');
    if (input.evidenceKind === 'REAL_MANUFACTURED') {
      const identityErrors = validateRealFixtureIdentity(input.openingTopology);
      if (identityErrors.length) throw new BadRequestException({ message: 'Real fixture identity is incomplete.', diagnostics: identityErrors });
    }
    return this.prisma.goldenFixture.create({
      data: {
        ...input,
        fixtureId: input.fixtureId.trim(),
        name: input.name.trim(),
        doorWindowType: input.doorWindowType.trim(),
        systemStableKey: input.systemStableKey.trim(),
        notes: input.notes?.trim() ?? '',
        dimensions: json(input.dimensions),
        openingTopology: json(input.openingTopology),
        profileRoleMapping: json(input.profileRoleMapping),
        expectedProfileIdentities: json(input.expectedProfileIdentities),
        expectedCuttingLengths: json(input.expectedCuttingLengths),
        expectedCuttingAngles: json(input.expectedCuttingAngles),
        expectedGlass: json(input.expectedGlass),
        expectedGasket: json(input.expectedGasket),
        expectedHardware: json(input.expectedHardware),
        expectedAccessories: json(input.expectedAccessories),
        expectedBom: json(input.expectedBom),
        expectedCuttingRequirements: json(input.expectedCuttingRequirements),
        candidateDesign: json(input.candidateDesign),
      },
    });
  }

  async calculate(user: JwtUser | undefined, id: string) {
    assertDatasetStudioActor(user);
    const fixture = await this.fixtureDetail(id);
    if (!fixture.datasetRevision || !fixture.doorDesignRevision || !fixture.technicalSource) throw new BadRequestException('Fixture must link a design revision, dataset revision, and technical source.');
    if (fixture.evidenceKind !== 'REAL_MANUFACTURED') throw new BadRequestException('Synthetic candidates cannot be used as technical golden fixtures.');
    const approvedExpected = fixture.expectedOutputRevisions.find((item) => item.status === 'APPROVED');
    if (!approvedExpected) throw new BadRequestException('APPROVED_EXPECTED_OUTPUT_REQUIRED');
    assertDatasetOwnership(user, fixture.datasetRevision.dataset.ownerOrganizationId);
    if (fixture.datasetRevision.status !== 'RELEASED') throw new BadRequestException('DATASET_NOT_RELEASED');
    if (fixture.technicalSource.sourceType === 'LEGACY_DATA' || fixture.technicalSource.reviewState !== 'APPROVED' || !fixture.technicalSource.reviewedAt) throw new BadRequestException('MISSING_TECHNICAL_SOURCE: an approved non-legacy source is required.');
    if (!fixture.datasetRevision.ruleDefinitions.length || fixture.datasetRevision.ruleDefinitions.some((rule) => rule.reviewState !== 'APPROVED')) throw new BadRequestException('RULE_NOT_VERIFIED');

    const startedAt = new Date();
    const design = this.toCanonicalDesign(fixture.doorDesignRevision);
    const evaluated = await this.rules.evaluate(design);
    const resolved = await this.resolver.resolve(fixture.datasetRevision.id, fixture.systemStableKey, evaluated.requirements);
    const diagnostics = [...evaluated.diagnostics, ...resolved.diagnostics];
    if (diagnostics.some((item) => item.severity === 'ERROR')) throw new BadRequestException({ message: 'Fixture calculation has blocking diagnostics.', diagnostics });
    const bom = this.bom.toLines(resolved.requirements);
    const pieces = bom
      .filter((line) => line.category === 'ALUMINIUM' && line.lengthMm && line.quantity > 0)
      .map((line) => ({ id: line.id, materialKey: line.materialStableKey ?? line.role, lengthMm: line.lengthMm!, quantity: line.quantity }));
    const cutting = this.cutting.optimize(pieces, [], { stockLengthMm: 6000, kerfMm: 3, minimumReusableRemnantMm: 1000 });
    const output = { design, materialRequirements: evaluated.requirements, resolvedRequirements: resolved.requirements, bom, cutting, diagnostics };
    const trace = await this.traces.record({
      doorDesignRevisionId: fixture.doorDesignRevision.id,
      datasetRevisionId: fixture.datasetRevision.id,
      engineVersion: evaluated.engineVersion,
      rulePackVersion: evaluated.rulePackVersion,
      calculationInput: design,
      calculationOutput: output,
      warnings: diagnostics.filter((item) => item.severity === 'WARNING'),
      startedAt,
      steps: [
        { stage: 'CANONICAL_DESIGN', input: design, output: { valid: true } },
        { stage: 'RULE_EVALUATION', sourceRule: evaluated.rulePackVersion, input: design, output: evaluated.requirements, diagnostics: evaluated.diagnostics },
        { stage: 'DATASET_RESOLUTION', input: evaluated.requirements, output: resolved.requirements, diagnostics: resolved.diagnostics },
        { stage: 'BOM', input: resolved.requirements, output: bom },
        { stage: 'CUTTING', input: pieces, output: cutting },
      ],
    });
    const actualOutput = { ...output, traceId: trace.id };
    const updated = await this.prisma.goldenFixture.update({
      where: { id },
      data: { actualOutput: json(actualOutput), ruleVersion: evaluated.rulePackVersion, engineVersion: evaluated.engineVersion, status: 'CALCULATED', rejectionReason: '' },
    });
    await this.comparisons.compare({
      kind: 'DESIGN_REVISION',
      fixtureId: fixture.id,
      rightTraceId: trace.id,
      leftLabel: 'Expected approved fixture output',
      rightLabel: 'V2 calculated output',
      leftOutput: approvedExpected.output,
      rightOutput: output,
      createdById: user.sub,
    });
    await this.audit(id, 'CALCULATE', fixture.status, 'CALCULATED', user.sub, `Trace ${trace.executionId}`);
    return { fixture: updated, trace };
  }

  async submitReview(user: JwtUser | undefined, id: string, input: { reviewChecks: Record<string, boolean>; notes: string }) {
    assertDatasetStudioActor(user);
    const fixture = await this.fixtureDetail(id);
    if (fixture.status !== 'CALCULATED') throw new BadRequestException('Only a calculated fixture can enter technical review.');
    if (!fixture.expectedOutputRevisions.some((item) => item.status === 'APPROVED')) throw new BadRequestException('APPROVED_EXPECTED_OUTPUT_REQUIRED');
    if (!input.notes.trim()) throw new BadRequestException('Technical review notes are required.');
    const updated = await this.prisma.goldenFixture.update({ where: { id }, data: { status: 'TECHNICAL_REVIEW', reviewChecks: json(input.reviewChecks), notes: input.notes.trim() } });
    await this.audit(id, 'SUBMIT_REVIEW', fixture.status, 'TECHNICAL_REVIEW', user.sub, input.notes);
    return updated;
  }

  async approve(user: JwtUser | undefined, id: string, input: { notes: string }) {
    assertDatasetStudioActor(user);
    const fixture = await this.fixtureDetail(id);
    if (fixture.datasetRevision) assertDatasetOwnership(user, fixture.datasetRevision.dataset.ownerOrganizationId);
    const approvedExpected = fixture.expectedOutputRevisions.find((item) => item.status === 'APPROVED');
    const latestThreeWay = fixture.comparisons.find((comparison) => comparison.kind === 'TECHNICAL_TRUTH_THREE_WAY');
    assertGoldenFixtureApproval({
      status: fixture.status,
      actualOutput: fixture.actualOutput,
      datasetStatus: fixture.datasetRevision?.status,
      sourceType: fixture.technicalSource?.sourceType,
      sourceReviewedAt: fixture.technicalSource?.reviewedAt,
      sourceReviewState: fixture.technicalSource?.reviewState,
      evidenceKind: fixture.evidenceKind,
      expectedOutputStatus: approvedExpected?.status,
      expectedOutput: approvedExpected?.output,
      ruleStates: fixture.datasetRevision?.ruleDefinitions.map((rule) => rule.reviewState) ?? [],
      comparisonStatuses: latestThreeWay ? [latestThreeWay.status] : [],
      openTechnicalIssues: fixture.technicalIssues.filter((issue) => ['OPEN', 'IN_REVIEW'].includes(issue.status)).length,
      reviewChecks: fixture.reviewChecks,
    });
    if (!input.notes.trim()) throw new BadRequestException('Verification approval notes are required.');
    const updated = await this.prisma.goldenFixture.update({ where: { id }, data: { status: 'VERIFIED', verifiedExpectedOutputRevisionId: approvedExpected!.id, reviewerId: user.sub, approvalTimestamp: new Date(), notes: input.notes.trim() } });
    await this.audit(id, 'VERIFY', fixture.status, 'VERIFIED', user.sub, input.notes);
    return updated;
  }

  async reject(user: JwtUser | undefined, id: string, input: { reason: string }) {
    assertDatasetStudioActor(user);
    const fixture = await this.fixtureDetail(id);
    if (!input.reason.trim()) throw new BadRequestException('A rejection reason is required.');
    const updated = await this.prisma.goldenFixture.update({ where: { id }, data: { status: 'REJECTED', reviewerId: user.sub, rejectionReason: input.reason.trim() } });
    await this.audit(id, 'REJECT', fixture.status, 'REJECTED', user.sub, input.reason);
    return updated;
  }

  private fixtureDetail(id: string) {
    return this.prisma.goldenFixture.findUnique({
      where: { id },
      include: {
        technicalSource: true,
        comparisons: { orderBy: { createdAt: 'desc' } },
        expectedOutputRevisions: { orderBy: { revisionNumber: 'desc' } },
        ruleUsages: { include: { ruleRecord: true } },
        technicalIssues: { orderBy: { createdAt: 'desc' } },
        datasetRevision: { include: { dataset: true, ruleDefinitions: true } },
        doorDesignRevision: {
          include: { doorDesign: true, openings: true, panels: true, members: true, connections: true, glazingPanels: true, hardwareNeeds: true },
        },
      },
    }).then((fixture) => {
      if (!fixture) throw new NotFoundException('Golden fixture does not exist.');
      return fixture;
    });
  }

  private toCanonicalDesign(revision: NonNullable<Awaited<ReturnType<GoldenFixtureService['fixtureDetail']>>['doorDesignRevision']>): CanonicalDoorDesignRevision {
    const panelById = new Map(revision.panels.map((panel) => [panel.id, panel.componentId]));
    const openingById = new Map(revision.openings.map((opening) => [opening.id, opening.componentId]));
    return {
      id: revision.id,
      designStableKey: revision.doorDesign.stableKey,
      revisionNumber: revision.revisionNumber,
      status: revision.status,
      category: revision.doorDesign.category as CanonicalDoorDesignRevision['category'],
      widthMm: revision.widthMm,
      heightMm: revision.heightMm,
      openingType: revision.openingType,
      leafCount: revision.leafCount,
      handing: revision.handing as CanonicalDoorDesignRevision['handing'],
      openingDirection: revision.openingDirection as CanonicalDoorDesignRevision['openingDirection'],
      openings: revision.openings.map((item) => ({ id: item.componentId, kind: item.kind as CanonicalDoorDesignRevision['openings'][number]['kind'], geometry: item.geometry as unknown as GeometryBox, attributes: item.attributes as Record<string, unknown> | undefined })),
      panels: revision.panels.map((item) => ({ id: item.componentId, openingId: item.openingId ? openingById.get(item.openingId) : undefined, parentPanelId: item.parentPanelId ? panelById.get(item.parentPanelId) : undefined, kind: item.kind as CanonicalDoorDesignRevision['panels'][number]['kind'], operation: item.operation as CanonicalDoorDesignRevision['panels'][number]['operation'], geometry: item.geometry as unknown as GeometryBox, attributes: item.attributes as Record<string, unknown> | undefined })),
      members: revision.members.map((item) => ({ id: item.componentId, role: item.roleCode, geometry: item.geometry as unknown as CanonicalDoorDesignRevision['members'][number]['geometry'], attributes: item.attributes as Record<string, unknown> | undefined })),
      connections: revision.connections.map((item) => ({ id: item.componentId, fromComponentId: item.fromComponentId, toComponentId: item.toComponentId, type: item.connectionType, attributes: item.attributes as Record<string, unknown> | undefined })),
      glazingPanels: revision.glazingPanels.map((item) => ({ id: item.componentId, panelId: item.panelId ? panelById.get(item.panelId) : undefined, glassIntent: item.glassIntent, geometry: item.geometry as unknown as GeometryBox, constraints: item.constraints as Record<string, unknown> | undefined })),
      hardwareIntent: revision.hardwareNeeds.map((item) => ({ id: `${item.componentId}:${item.roleCode}`, componentId: item.componentId, role: item.roleCode, quantity: item.quantity, unit: item.unit, attributes: item.attributes as Record<string, unknown> | undefined, constraints: item.constraints as Record<string, unknown> | undefined })),
      constraints: revision.constraints as Record<string, unknown> | undefined,
      provenance: revision.source as Record<string, unknown> | undefined,
    };
  }

  private audit(entityId: string, action: string, fromStatus: string, toStatus: string, actorId: string, notes: string) {
    return this.prisma.technicalReviewEvent.create({ data: { entityType: 'GOLDEN_FIXTURE', entityId, action, fromStatus, toStatus, actorId, notes: notes.trim() } });
  }
}
