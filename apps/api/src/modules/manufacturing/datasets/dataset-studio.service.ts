import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type TechnicalSourceType } from '@prisma/client';
import type { JwtUser } from '../../../auth/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { MATERIAL_ROLE_BY_CODE } from '../material-roles';
import { versionIdentity } from '../rules/version-identity';
import { assertDatasetOwnership, assertDatasetStudioActor, datasetOwnerForCreate } from './dataset-studio.policy';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const clonedJson = (value: Prisma.JsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

export type DatasetImportInput = {
  source: {
    sourceType: TechnicalSourceType;
    sourceDocument: string;
    sourceRevision?: string;
    sourcePage?: string;
    sourceDate?: string;
    sourceFileObjectId?: string;
    sourceHash?: string;
    technicalOwner?: string;
    notes?: string;
  };
  systems: Array<{
    stableKey: string;
    code: string;
    name: string;
    legacyAluSystemId?: string;
    attributes?: Record<string, unknown>;
    profiles: Array<{
      stableKey: string;
      code: string;
      name: string;
      stockLengthMm: number;
      kgPerMeter: number;
      thicknessMm?: string;
      legacyProfileId?: string;
      technicalData?: Record<string, unknown>;
    }>;
    roleMappings: Array<{
      roleCode: string;
      profileStableKey: string;
      priority?: number;
      attributes?: Record<string, unknown>;
      constraints?: Record<string, unknown>;
    }>;
  }>;
  compatibilityRules?: Array<{ systemStableKey?: string; ruleType: string; ruleKey: string; expression: unknown; message?: string; priority?: number }>;
  hardwareItems?: Array<{ stableKey: string; code: string; name: string; roleCode: string; attributes?: Record<string, unknown> }>;
  gasketItems?: Array<{ stableKey: string; code: string; name: string; attributes?: Record<string, unknown> }>;
  glassRules?: Array<{ ruleKey: string; glassType: string; expression: unknown; constraints?: Record<string, unknown> }>;
  finishCompatibilities?: Array<{ finishKey: string; materialKey: string; compatible?: boolean; constraints?: Record<string, unknown> }>;
  assemblyRules?: Array<{ ruleKey: string; appliesTo: string; rule: unknown }>;
};

export type DatasetDiagnostic = { code: string; severity: 'ERROR' | 'WARNING'; message: string; entityId?: string };

export function assertDatasetRevisionMutableStatus(status: string) {
  if (status !== 'DRAFT') {
    throw new BadRequestException('Released or reviewed technical data is immutable. Create a new DRAFT revision.');
  }
}

@Injectable()
export class DatasetStudioService {
  constructor(private readonly prisma: PrismaService) {}

  async listDatasets(user: JwtUser | undefined) {
    assertDatasetStudioActor(user);
    return this.prisma.materialDataset.findMany({
      where: user.isCeo ? undefined : { ownerOrganizationId: user.organizationId ?? null },
      orderBy: { updatedAt: 'desc' },
      include: { manufacturer: true, revisions: { orderBy: { revisionNumber: 'desc' } } },
    });
  }

  async createDataset(user: JwtUser | undefined, input: {
    stableKey: string;
    name: string;
    description?: string;
    manufacturerCode: string;
    manufacturerName: string;
    ownerOrganizationId?: string | null;
  }) {
    assertDatasetStudioActor(user);
    const stableKey = input.stableKey.trim().toLowerCase();
    if (!stableKey || !input.name.trim() || !input.manufacturerCode.trim()) throw new BadRequestException('Dataset identity and manufacturer are required.');
    const ownerOrganizationId = datasetOwnerForCreate(user, input.ownerOrganizationId);
    return this.prisma.$transaction(async (tx) => {
      const manufacturer = await tx.manufacturer.upsert({
        where: { code: input.manufacturerCode.trim().toUpperCase() },
        create: { code: input.manufacturerCode.trim().toUpperCase(), name: input.manufacturerName.trim() },
        update: { name: input.manufacturerName.trim() },
      });
      const dataset = await tx.materialDataset.create({
        data: {
          stableKey,
          name: input.name.trim(),
          description: input.description?.trim() ?? '',
          manufacturerId: manufacturer.id,
          ownerOrganizationId,
          verificationStatus: 'DRAFT',
          revisions: { create: { revisionNumber: 1, versionTag: 'draft-1' } },
        },
        include: { manufacturer: true, revisions: true },
      });
      await this.audit(tx, 'DATASET_REVISION', dataset.revisions[0].id, 'CREATE', '', 'DRAFT', user.sub, 'Initial dataset revision.');
      return dataset;
    });
  }

  async getRevision(user: JwtUser | undefined, revisionId: string) {
    assertDatasetStudioActor(user);
    const revision = await this.prisma.datasetRevision.findUnique({
      where: { id: revisionId },
      include: {
        dataset: { include: { manufacturer: true } },
        systems: { include: { profiles: true, roleMappings: { include: { profileRevision: true } } } },
        compatibilityRules: true,
        hardwareItems: true,
        gasketItems: true,
        glassRules: true,
        finishCompatibilities: true,
        assemblyRules: true,
        technicalSources: { include: { links: true } },
        ruleDefinitions: true,
      },
    });
    if (!revision) throw new NotFoundException('Dataset revision does not exist.');
    assertDatasetOwnership(user, revision.dataset.ownerOrganizationId);
    return revision;
  }

  async createRevision(user: JwtUser | undefined, datasetId: string, input: { versionTag: string; fromRevisionId?: string }) {
    assertDatasetStudioActor(user);
    const dataset = await this.prisma.materialDataset.findUnique({ where: { id: datasetId }, include: { revisions: { orderBy: { revisionNumber: 'desc' } } } });
    if (!dataset) throw new NotFoundException('Dataset does not exist.');
    assertDatasetOwnership(user, dataset.ownerOrganizationId);
    const nextNumber = (dataset.revisions[0]?.revisionNumber ?? 0) + 1;
    const versionTag = input.versionTag.trim() || `draft-${nextNumber}`;
    if (!input.fromRevisionId) {
      return this.prisma.$transaction(async (tx) => {
        const revision = await tx.datasetRevision.create({ data: { datasetId, revisionNumber: nextNumber, versionTag } });
        await this.audit(tx, 'DATASET_REVISION', revision.id, 'CREATE', '', 'DRAFT', user.sub, 'Empty draft revision.');
        return revision;
      });
    }
    const source = await this.getRevision(user, input.fromRevisionId);
    if (source.datasetId !== datasetId) throw new BadRequestException('Source revision belongs to another dataset.');
    return this.cloneRevision(source, nextNumber, versionTag, user.sub);
  }

  async importRevision(user: JwtUser | undefined, revisionId: string, input: DatasetImportInput) {
    assertDatasetStudioActor(user);
    const revision = await this.getRevision(user, revisionId);
    this.assertDraft(revision.status);
    if (!input.source?.sourceDocument?.trim()) throw new BadRequestException('A technical source document is required.');
    if (!input.systems?.length) throw new BadRequestException('At least one aluminium system is required.');
    const duplicateSystem = this.findDuplicate(input.systems.map((item) => item.stableKey));
    if (duplicateSystem) throw new BadRequestException(`Duplicate system stable key: ${duplicateSystem}.`);

    await this.prisma.$transaction(async (tx) => {
      await tx.profileRoleMapping.deleteMany({ where: { datasetRevisionId: revisionId } });
      await tx.profileRevision.deleteMany({ where: { datasetRevisionId: revisionId } });
      await tx.aluminiumSystemV2.deleteMany({ where: { datasetRevisionId: revisionId } });
      await Promise.all([
        tx.compatibilityRule.deleteMany({ where: { datasetRevisionId: revisionId } }),
        tx.datasetHardwareItem.deleteMany({ where: { datasetRevisionId: revisionId } }),
        tx.datasetGasketItem.deleteMany({ where: { datasetRevisionId: revisionId } }),
        tx.datasetGlassRule.deleteMany({ where: { datasetRevisionId: revisionId } }),
        tx.finishCompatibility.deleteMany({ where: { datasetRevisionId: revisionId } }),
        tx.assemblyRule.deleteMany({ where: { datasetRevisionId: revisionId } }),
      ]);

      const systemIds = new Map<string, string>();
      const profileIds = new Map<string, string>();
      for (const systemInput of input.systems) {
        const system = await tx.aluminiumSystemV2.create({
          data: {
            datasetRevisionId: revisionId,
            stableKey: systemInput.stableKey.trim(),
            code: systemInput.code.trim(),
            name: systemInput.name.trim(),
            legacyAluSystemId: systemInput.legacyAluSystemId,
            attributes: systemInput.attributes ? json(systemInput.attributes) : undefined,
          },
        });
        systemIds.set(systemInput.stableKey, system.id);
        const duplicateProfile = this.findDuplicate(systemInput.profiles.map((item) => item.stableKey));
        if (duplicateProfile) throw new BadRequestException(`Duplicate profile stable key: ${duplicateProfile}.`);
        for (const profileInput of systemInput.profiles) {
          const profile = await tx.profileRevision.create({
            data: {
              datasetRevisionId: revisionId,
              aluminiumSystemId: system.id,
              stableKey: profileInput.stableKey.trim(),
              code: profileInput.code.trim(),
              name: profileInput.name.trim(),
              stockLengthMm: profileInput.stockLengthMm,
              kgPerMeter: profileInput.kgPerMeter,
              thicknessMm: profileInput.thicknessMm,
              legacyProfileId: profileInput.legacyProfileId,
              technicalData: profileInput.technicalData ? json(profileInput.technicalData) : undefined,
            },
          });
          profileIds.set(`${systemInput.stableKey}:${profileInput.stableKey}`, profile.id);
        }
        for (const mappingInput of systemInput.roleMappings) {
          const profileRevisionId = profileIds.get(`${systemInput.stableKey}:${mappingInput.profileStableKey}`);
          if (!profileRevisionId) throw new BadRequestException(`Role ${mappingInput.roleCode} references an unknown profile.`);
          await tx.profileRoleMapping.create({
            data: {
              datasetRevisionId: revisionId,
              aluminiumSystemId: system.id,
              roleCode: mappingInput.roleCode,
              profileRevisionId,
              priority: mappingInput.priority ?? 100,
              attributes: mappingInput.attributes ? json(mappingInput.attributes) : undefined,
              constraints: mappingInput.constraints ? json(mappingInput.constraints) : undefined,
            },
          });
        }
      }

      for (const item of input.compatibilityRules ?? []) {
        await tx.compatibilityRule.create({ data: { datasetRevisionId: revisionId, aluminiumSystemId: item.systemStableKey ? systemIds.get(item.systemStableKey) : undefined, ruleType: item.ruleType, ruleKey: item.ruleKey, expression: json(item.expression), message: item.message ?? '', priority: item.priority ?? 100 } });
      }
      for (const item of input.hardwareItems ?? []) await tx.datasetHardwareItem.create({ data: { datasetRevisionId: revisionId, stableKey: item.stableKey, code: item.code, name: item.name, roleCode: item.roleCode, attributes: item.attributes ? json(item.attributes) : undefined } });
      for (const item of input.gasketItems ?? []) await tx.datasetGasketItem.create({ data: { datasetRevisionId: revisionId, stableKey: item.stableKey, code: item.code, name: item.name, attributes: item.attributes ? json(item.attributes) : undefined } });
      for (const item of input.glassRules ?? []) await tx.datasetGlassRule.create({ data: { datasetRevisionId: revisionId, ruleKey: item.ruleKey, glassType: item.glassType, expression: json(item.expression), constraints: item.constraints ? json(item.constraints) : undefined } });
      for (const item of input.finishCompatibilities ?? []) await tx.finishCompatibility.create({ data: { datasetRevisionId: revisionId, finishKey: item.finishKey, materialKey: item.materialKey, compatible: item.compatible ?? true, constraints: item.constraints ? json(item.constraints) : undefined } });
      for (const item of input.assemblyRules ?? []) await tx.assemblyRule.create({ data: { datasetRevisionId: revisionId, ruleKey: item.ruleKey, appliesTo: item.appliesTo, rule: json(item.rule) } });

      await tx.technicalSource.create({
        data: {
          datasetRevisionId: revisionId,
          sourceType: input.source.sourceType,
          sourceDocument: input.source.sourceDocument.trim(),
          sourceRevision: input.source.sourceRevision?.trim() ?? '',
          sourcePage: input.source.sourcePage?.trim() ?? '',
          sourceDate: input.source.sourceDate ? new Date(input.source.sourceDate) : undefined,
          sourceFileObjectId: input.source.sourceFileObjectId,
          sourceHash: input.source.sourceHash?.trim() ?? '',
          technicalOwner: input.source.technicalOwner?.trim() ?? '',
          ownerOrganizationId: revision.dataset.ownerOrganizationId,
          enteredById: user.sub,
          notes: input.source.notes?.trim() ?? '',
        },
      });
      await tx.datasetRevision.update({ where: { id: revisionId }, data: { validationReport: Prisma.DbNull, validationHash: '', reviewedById: null, reviewedAt: null, releasedById: null, releasedAt: null } });
      await this.audit(tx, 'DATASET_REVISION', revisionId, 'IMPORT', 'DRAFT', 'DRAFT', user.sub, input.source.sourceDocument);
    });
    return this.getRevision(user, revisionId);
  }

  async validateRevision(user: JwtUser | undefined, revisionId: string) {
    const revision = await this.getRevision(user, revisionId);
    const diagnostics = this.buildDiagnostics(revision);
    const validationHash = versionIdentity('dataset-validation', { revisionId, systems: revision.systems, diagnostics });
    await this.prisma.datasetRevision.update({ where: { id: revisionId }, data: { validationReport: json({ diagnostics }), validationHash } });
    return { valid: !diagnostics.some((item) => item.severity === 'ERROR'), validationHash, diagnostics };
  }

  async submitReview(user: JwtUser | undefined, revisionId: string, notes = '') {
    assertDatasetStudioActor(user);
    const revision = await this.getRevision(user, revisionId);
    this.assertDraft(revision.status);
    const validation = await this.validateRevision(user, revisionId);
    if (!validation.valid) throw new BadRequestException({ message: 'Dataset revision has blocking diagnostics.', diagnostics: validation.diagnostics });
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.datasetRevision.update({ where: { id: revisionId }, data: { status: 'REVIEW', reviewNotes: notes.trim() } });
      await this.audit(tx, 'DATASET_REVISION', revisionId, 'SUBMIT_REVIEW', 'DRAFT', 'REVIEW', user.sub, notes);
      return updated;
    });
  }

  async recordReview(user: JwtUser | undefined, revisionId: string, input: { notes: string }) {
    assertDatasetStudioActor(user);
    const revision = await this.getRevision(user, revisionId);
    if (revision.status !== 'REVIEW') throw new BadRequestException('Only a revision in REVIEW can receive technical review.');
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.datasetRevision.update({ where: { id: revisionId }, data: { reviewedById: user.sub, reviewedAt: now, reviewNotes: input.notes.trim() } });
      await this.audit(tx, 'DATASET_REVISION', revisionId, 'TECHNICAL_REVIEW', 'REVIEW', 'REVIEW', user.sub, input.notes);
      return updated;
    });
  }

  async release(user: JwtUser | undefined, revisionId: string, notes = '') {
    assertDatasetStudioActor(user);
    const revision = await this.getRevision(user, revisionId);
    if (revision.status !== 'REVIEW' || !revision.reviewedById || !revision.reviewedAt) throw new BadRequestException('Technical review is required before release.');
    const validation = await this.validateRevision(user, revisionId);
    const reviewedOfficialSource = revision.technicalSources.some((source) => source.sourceType !== 'LEGACY_DATA' && source.reviewState === 'APPROVED' && source.reviewedAt);
    if (!reviewedOfficialSource) throw new BadRequestException('Release requires a reviewed non-legacy technical source.');
    if (!validation.valid) throw new BadRequestException({ message: 'Dataset revision has blocking diagnostics.', diagnostics: validation.diagnostics });
    const unapprovedRules = revision.ruleDefinitions.filter((rule) => rule.reviewState !== 'APPROVED');
    if (unapprovedRules.length) throw new BadRequestException('All rules linked to a released dataset must be approved.');
    const now = new Date();
    const contentHash = versionIdentity('dataset', this.datasetContent(revision));
    return this.prisma.$transaction(async (tx) => {
      await tx.datasetRevision.updateMany({ where: { datasetId: revision.datasetId, status: 'RELEASED', id: { not: revisionId } }, data: { status: 'RETIRED' } });
      await tx.technicalSource.updateMany({ where: { datasetRevisionId: revisionId }, data: { releasedById: user.sub, releasedAt: now } });
      const updated = await tx.datasetRevision.update({ where: { id: revisionId }, data: { status: 'RELEASED', verificationStatus: 'PARTIALLY_VERIFIED', contentHash, releasedById: user.sub, releasedAt: now, verificationNote: notes.trim() } });
      await tx.materialDataset.update({ where: { id: revision.datasetId }, data: { verificationStatus: 'PARTIALLY_VERIFIED' } });
      await this.audit(tx, 'DATASET_REVISION', revisionId, 'RELEASE', 'REVIEW', 'RELEASED', user.sub, notes, { contentHash });
      return updated;
    });
  }

  async retire(user: JwtUser | undefined, revisionId: string, notes = '') {
    assertDatasetStudioActor(user);
    const revision = await this.getRevision(user, revisionId);
    if (revision.status !== 'RELEASED') throw new BadRequestException('Only a released revision can be retired.');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.datasetRevision.update({ where: { id: revisionId }, data: { status: 'RETIRED', verificationStatus: 'RETIRED' } });
      await this.audit(tx, 'DATASET_REVISION', revisionId, 'RETIRE', 'RELEASED', 'RETIRED', user.sub, notes);
      return updated;
    });
  }

  private assertDraft(status: string) {
    assertDatasetRevisionMutableStatus(status);
  }

  private buildDiagnostics(revision: Awaited<ReturnType<DatasetStudioService['getRevision']>>): DatasetDiagnostic[] {
    const diagnostics: DatasetDiagnostic[] = [];
    if (!revision.systems.length) diagnostics.push({ code: 'DATASET_EMPTY', severity: 'ERROR', message: 'Dataset contains no aluminium system.' });
    if (!revision.technicalSources.length) diagnostics.push({ code: 'MISSING_TECHNICAL_SOURCE', severity: 'ERROR', message: 'Dataset has no technical source.' });
    if (!revision.ruleDefinitions.length) diagnostics.push({ code: 'RULE_NOT_VERIFIED', severity: 'ERROR', message: 'Dataset has no versioned manufacturing rule with provenance.' });
    for (const system of revision.systems) {
      if (!system.profiles.length) diagnostics.push({ code: 'SYSTEM_WITHOUT_PROFILE', severity: 'ERROR', message: `${system.code} has no profile.`, entityId: system.id });
      if (!system.roleMappings.length) diagnostics.push({ code: 'PROFILE_ROLE_UNRESOLVED', severity: 'ERROR', message: `${system.code} has no material role mapping.`, entityId: system.id });
      for (const profile of system.profiles) {
        if (profile.stockLengthMm <= 0 || profile.kgPerMeter <= 0) diagnostics.push({ code: 'INVALID_PROFILE_TECHNICAL_VALUE', severity: 'ERROR', message: `${profile.code} must have positive stock length and kg/m.`, entityId: profile.id });
        const data = profile.technicalData as Record<string, unknown> | null;
        if (Array.isArray(data?.unresolvedFields) && data.unresolvedFields.length) diagnostics.push({ code: 'UNRESOLVED_TECHNICAL_DATA', severity: 'ERROR', message: `${profile.code} still has unresolved fields.`, entityId: profile.id });
      }
      for (const mapping of system.roleMappings) {
        if (!(mapping.roleCode in MATERIAL_ROLE_BY_CODE)) diagnostics.push({ code: 'UNKNOWN_MATERIAL_ROLE', severity: 'ERROR', message: `Unknown material role ${mapping.roleCode}.`, entityId: mapping.id });
        if (mapping.profileRevision.aluminiumSystemId !== system.id) diagnostics.push({ code: 'PROFILE_NOT_COMPATIBLE', severity: 'ERROR', message: `Role ${mapping.roleCode} maps across systems.`, entityId: mapping.id });
      }
    }
    if (!revision.glassRules.length) diagnostics.push({ code: 'GLASS_RULE_MISSING', severity: 'WARNING', message: 'No glass rule has been authored.' });
    if (!revision.hardwareItems.length) diagnostics.push({ code: 'HARDWARE_RULE_MISSING', severity: 'WARNING', message: 'No hardware item has been authored.' });
    if (!revision.gasketItems.length) diagnostics.push({ code: 'GASKET_RULE_MISSING', severity: 'WARNING', message: 'No gasket item has been authored.' });
    return diagnostics;
  }

  private datasetContent(revision: Awaited<ReturnType<DatasetStudioService['getRevision']>>) {
    return {
      systems: revision.systems,
      compatibilityRules: revision.compatibilityRules,
      hardwareItems: revision.hardwareItems,
      gasketItems: revision.gasketItems,
      glassRules: revision.glassRules,
      finishCompatibilities: revision.finishCompatibilities,
      assemblyRules: revision.assemblyRules,
      sources: revision.technicalSources.map(({ sourceHash, sourceDocument, sourcePage, sourceRevision, sourceType }) => ({ sourceHash, sourceDocument, sourcePage, sourceRevision, sourceType })),
      rules: revision.ruleDefinitions,
    };
  }

  private findDuplicate(values: string[]): string | undefined {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) return value;
      seen.add(value);
    }
    return undefined;
  }

  private async cloneRevision(source: Awaited<ReturnType<DatasetStudioService['getRevision']>>, revisionNumber: number, versionTag: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.datasetRevision.create({ data: { datasetId: source.datasetId, revisionNumber, versionTag, provenance: source.provenance ?? undefined } });
      const systemMap = new Map<string, string>();
      const profileMap = new Map<string, string>();
      for (const system of source.systems) {
        const clonedSystem = await tx.aluminiumSystemV2.create({ data: { datasetRevisionId: target.id, stableKey: system.stableKey, code: system.code, name: system.name, legacyAluSystemId: system.legacyAluSystemId, attributes: system.attributes ?? undefined } });
        systemMap.set(system.id, clonedSystem.id);
        for (const profile of system.profiles) {
          const clonedProfile = await tx.profileRevision.create({ data: { datasetRevisionId: target.id, aluminiumSystemId: clonedSystem.id, stableKey: profile.stableKey, code: profile.code, name: profile.name, stockLengthMm: profile.stockLengthMm, kgPerMeter: profile.kgPerMeter, thicknessMm: profile.thicknessMm, legacyProfileId: profile.legacyProfileId, technicalData: profile.technicalData ?? undefined } });
          profileMap.set(profile.id, clonedProfile.id);
        }
        for (const mapping of system.roleMappings) await tx.profileRoleMapping.create({ data: { datasetRevisionId: target.id, aluminiumSystemId: clonedSystem.id, roleCode: mapping.roleCode, profileRevisionId: profileMap.get(mapping.profileRevisionId)!, priority: mapping.priority, attributes: mapping.attributes ?? undefined, constraints: mapping.constraints ?? undefined } });
      }
      for (const item of source.compatibilityRules) await tx.compatibilityRule.create({ data: { datasetRevisionId: target.id, aluminiumSystemId: item.aluminiumSystemId ? systemMap.get(item.aluminiumSystemId) : undefined, ruleType: item.ruleType, ruleKey: item.ruleKey, expression: clonedJson(item.expression), message: item.message, priority: item.priority, active: item.active } });
      for (const item of source.hardwareItems) await tx.datasetHardwareItem.create({ data: { datasetRevisionId: target.id, stableKey: item.stableKey, code: item.code, name: item.name, roleCode: item.roleCode, attributes: item.attributes ?? undefined } });
      for (const item of source.gasketItems) await tx.datasetGasketItem.create({ data: { datasetRevisionId: target.id, stableKey: item.stableKey, code: item.code, name: item.name, attributes: item.attributes ?? undefined } });
      for (const item of source.glassRules) await tx.datasetGlassRule.create({ data: { datasetRevisionId: target.id, ruleKey: item.ruleKey, glassType: item.glassType, expression: clonedJson(item.expression), constraints: item.constraints ?? undefined } });
      for (const item of source.finishCompatibilities) await tx.finishCompatibility.create({ data: { datasetRevisionId: target.id, finishKey: item.finishKey, materialKey: item.materialKey, compatible: item.compatible, constraints: item.constraints ?? undefined } });
      for (const item of source.assemblyRules) await tx.assemblyRule.create({ data: { datasetRevisionId: target.id, ruleKey: item.ruleKey, appliesTo: item.appliesTo, rule: clonedJson(item.rule), active: item.active } });
      const sourceMap = new Map<string, string>();
      for (const item of source.technicalSources) {
        const clonedSource = await tx.technicalSource.create({ data: { datasetRevisionId: target.id, sourceType: item.sourceType, sourceDocument: item.sourceDocument, sourceRevision: item.sourceRevision, sourcePage: item.sourcePage, sourceDate: item.sourceDate, sourceFileObjectId: item.sourceFileObjectId, sourceHash: item.sourceHash, technicalOwner: item.technicalOwner, ownerOrganizationId: item.ownerOrganizationId, enteredById: actorId, notes: `Cloned from revision ${source.versionTag}. ${item.notes}`.trim(), metadata: item.metadata ?? undefined } });
        sourceMap.set(item.id, clonedSource.id);
      }
      for (const rule of source.ruleDefinitions) await tx.manufacturingRuleRecord.create({ data: { datasetRevisionId: target.id, technicalSourceId: rule.technicalSourceId ? sourceMap.get(rule.technicalSourceId) : undefined, ruleId: rule.ruleId, ruleVersion: `${rule.ruleVersion}-draft-${revisionNumber}`, purpose: rule.purpose, inputs: clonedJson(rule.inputs), outputSemantics: clonedJson(rule.outputSemantics), implementation: clonedJson(rule.implementation), technicalJustification: rule.technicalJustification, effectiveRevision: rule.effectiveRevision, systemStableKey: rule.systemStableKey, constants: rule.constants === null ? Prisma.JsonNull : rule.constants as Prisma.InputJsonValue, sourceReference: rule.sourceReference } });
      await this.audit(tx, 'DATASET_REVISION', target.id, 'CLONE', source.status, 'DRAFT', actorId, `Cloned from ${source.id}.`);
      return target;
    });
  }

  private audit(tx: Prisma.TransactionClient, entityType: string, entityId: string, action: string, fromStatus: string, toStatus: string, actorId: string, notes: string, metadata?: unknown) {
    return tx.technicalReviewEvent.create({ data: { entityType, entityId, action, fromStatus, toStatus, actorId, notes: notes.trim(), metadata: metadata === undefined ? undefined : json(metadata) } });
  }
}
