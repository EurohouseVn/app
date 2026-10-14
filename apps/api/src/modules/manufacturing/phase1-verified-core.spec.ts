import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { assertBomTransition } from './bom/bom.service';
import { assertComparisonOwnership, comparisonVisibilityWhere } from './comparison/comparison.service';
import { technicalTruthDiff } from './comparison/technical-truth-diff';
import { classifyDatasetVerification } from './datasets/dataset-coverage.service';
import { structuredDiff } from './comparison/structured-diff';
import { assertDatasetOwnership } from './datasets/dataset-studio.policy';
import { assertDatasetRevisionMutableStatus } from './datasets/dataset-studio.service';
import { resolveMaterialRequirements } from './datasets/dataset-resolver';
import { assertManufacturingFeatureEnabled, manufacturingFeatureFlags } from './feature-flags';
import { validateRuleProvenance } from './rules/rule-provenance.service';
import { goldenFixtureApprovalBlockers } from './verification/golden-fixture.policy';
import { assertExpectedOutputMutable, validateManualExpectedOutput } from './verification/expected-output.service';
import { buildFrozenGoldenRegressionCase, validateRealFixtureIdentity } from './verification/golden-fixture.service';

const admin = { sub: 'admin', email: 'admin@eurohouse.vn', role: 'ADMIN' as const, organizationId: 'org-a', isCeo: false };

test('Phase 1 feature flags are independently disabled by default', () => {
  const flags = manufacturingFeatureFlags({} as NodeJS.ProcessEnv);
  assert.equal(Object.values(flags).every((value) => value === false), true);
});

test('disabled Phase 1 endpoint flags fail closed', () => {
  assert.throws(() => assertManufacturingFeatureEnabled('datasetStudio', {} as NodeJS.ProcessEnv));
  assert.doesNotThrow(() => assertManufacturingFeatureEnabled('datasetStudio', { EUROHOUSE_DATASET_STUDIO: 'true' } as NodeJS.ProcessEnv));
});

test('released dataset revisions are immutable', () => {
  assert.throws(() => assertDatasetRevisionMutableStatus('RELEASED'), BadRequestException);
  assert.doesNotThrow(() => assertDatasetRevisionMutableStatus('DRAFT'));
});

test('dataset tenant boundary rejects another organization', () => {
  assert.throws(() => assertDatasetOwnership(admin, 'org-b'), ForbiddenException);
  assert.doesNotThrow(() => assertDatasetOwnership(admin, 'org-a'));
});

test('CEO can inspect datasets across organizations', () => {
  assert.doesNotThrow(() => assertDatasetOwnership({ ...admin, isCeo: true }, 'org-b'));
});

test('calculation comparisons are scoped to the creating Admin', () => {
  assert.deepEqual(comparisonVisibilityWhere(admin), { createdById: admin.sub });
  assert.throws(() => assertComparisonOwnership(admin, 'other-admin'), NotFoundException);
  assert.doesNotThrow(() => assertComparisonOwnership(admin, admin.sub));
});

test('CEO can inspect and review calculation comparisons across creators', () => {
  const ceo = { ...admin, isCeo: true };
  assert.equal(comparisonVisibilityWhere(ceo), undefined);
  assert.doesNotThrow(() => assertComparisonOwnership(ceo, 'other-admin'));
});

test('rule provenance rejects missing source, justification, and effective revision', () => {
  assert.deepEqual(validateRuleProvenance({}), [
    'MISSING_TECHNICAL_SOURCE',
    'MISSING_TECHNICAL_JUSTIFICATION',
    'MISSING_EFFECTIVE_REVISION',
  ]);
  assert.deepEqual(validateRuleProvenance({ technicalSourceId: 's', technicalJustification: 'catalogue p.12', effectiveRevision: 'R18' }), []);
});

test('unresolved material role produces a blocking diagnostic', () => {
  const result = resolveMaterialRequirements('revision', [{
    id: 'req-1', category: 'ALUMINIUM', role: 'FRAME_OUTER', componentId: 'frame', quantity: 1, unit: 'piece', attributes: {}, constraints: {}, sourceRule: 'rule',
  }], []);
  assert.equal(result.diagnostics[0]?.code, 'DATASET_ROLE_UNRESOLVED');
  assert.equal(result.diagnostics[0]?.severity, 'ERROR');
});

test('structured calculation diff reports numeric delta', () => {
  const differences = structuredDiff('bom', { kg: 10 }, { kg: 11.5 });
  assert.equal(differences[0].classification, 'UNEXPLAINED_DIFFERENCE');
  assert.equal(differences[0].delta, 1.5);
});

test('three-way comparison classifies both engines against technical truth', () => {
  const differences = technicalTruthDiff('bom', { kg: 10, count: 2 }, { kg: 9, count: 2 }, { kg: 10, count: 3 });
  assert.equal(differences.find((item) => item.field === 'kg')?.classification, 'V2_MATCH_TECHNICAL');
  assert.equal(differences.find((item) => item.field === 'count')?.classification, 'LEGACY_MATCH_TECHNICAL');
});

test('manual expected output requires explicit applicability and no circular defaults', () => {
  assert.ok(validateManualExpectedOutput({ topology: {} }).length > 0);
  const arrays = { profiles: [], quantities: [], cuttingLengths: [], cuttingAngles: [], machining: [], glass: [], gaskets: [], hardware: [], accessories: [], bom: [], cuttingRequirements: [] };
  const applicability = Object.fromEntries(Object.keys(arrays).map((key) => [key, false]));
  const notApplicableReasons = Object.fromEntries(Object.keys(arrays).map((key) => [key, 'Confirmed not applicable by approved source.']));
  assert.deepEqual(validateManualExpectedOutput({ topology: {}, applicability, notApplicableReasons, ...arrays }), []);
  assert.throws(() => assertExpectedOutputMutable('APPROVED'), BadRequestException);
});

test('real fixture identity is topology based, not dimension only', () => {
  assert.ok(validateRealFixtureIdentity({ widthMm: 900, heightMm: 2200 }).length > 0);
  assert.deepEqual(validateRealFixtureIdentity({ openingMechanism: 'SWING', leafCount: 1, fixedPanels: [], mullionTransomArrangement: 'NONE', glassConfiguration: 'SINGLE_PANEL', hardwareConfiguration: 'HINGE_LOCK' }), []);
});

test('dataset release remains partial until every evidence dimension and fixture passes', () => {
  const complete = { covered: 1, total: 1, ratio: 1 };
  const missing = { covered: 0, total: 1, ratio: 0 };
  assert.equal(classifyDatasetVerification({ revisionStatus: 'RELEASED', dimensions: [complete, missing], systems: 1, verifiedFixtures: 1, realFixtures: 1, openIssues: 0 }), 'PARTIALLY_VERIFIED');
  assert.equal(classifyDatasetVerification({ revisionStatus: 'RELEASED', dimensions: [complete], systems: 1, verifiedFixtures: 1, realFixtures: 1, openIssues: 0 }), 'VERIFIED');
});

test('golden regression case freezes every required revision and expected output hash', () => {
  const frozen = buildFrozenGoldenRegressionCase({
    fixtureId: 'EH-REAL-001', name: 'Cửa đi một cánh', doorDesignRevisionId: 'design-r3', datasetRevisionId: 'dataset-r2',
    ruleVersion: 'rules-r4', engineVersion: 'engine-v2.1.0', verifiedExpectedOutputRevisionId: 'expected-r2',
    verifiedExpectedOutputRevision: { revisionNumber: 2, contentHash: 'sha256:expected', output: { bom: [] } },
  });
  assert.deepEqual(frozen, {
    fixtureId: 'EH-REAL-001', fixtureName: 'Cửa đi một cánh', doorDesignRevisionId: 'design-r3', datasetRevisionId: 'dataset-r2',
    rulePackVersion: 'rules-r4', engineVersion: 'engine-v2.1.0', expectedOutputRevisionId: 'expected-r2',
    expectedOutputRevisionNumber: 2, expectedOutputContentHash: 'sha256:expected', expectedOutput: { bom: [] },
  });
});

test('golden regression case rejects incomplete frozen references', () => {
  assert.throws(() => buildFrozenGoldenRegressionCase({
    fixtureId: 'EH-REAL-001', name: 'Incomplete', doorDesignRevisionId: null, datasetRevisionId: 'dataset-r2',
    ruleVersion: 'rules-r4', engineVersion: 'engine-v2.1.0', verifiedExpectedOutputRevisionId: 'expected-r2',
    verifiedExpectedOutputRevision: { revisionNumber: 2, contentHash: 'sha256:expected', output: {} },
  }), BadRequestException);
});

test('BOM reviewed release follows the strict lifecycle', () => {
  assert.doesNotThrow(() => assertBomTransition('DRAFT', 'CALCULATE'));
  assert.doesNotThrow(() => assertBomTransition('CALCULATED', 'SUBMIT_REVIEW'));
  assert.doesNotThrow(() => assertBomTransition('TECHNICAL_REVIEW', 'APPROVE'));
  assert.doesNotThrow(() => assertBomTransition('APPROVED', 'RELEASE'));
  assert.throws(() => assertBomTransition('DRAFT', 'RELEASE'), BadRequestException);
});

test('golden fixture approval blocks unreleased data and unexplained differences', () => {
  const blockers = goldenFixtureApprovalBlockers({
    status: 'TECHNICAL_REVIEW',
    actualOutput: { ok: true },
    datasetStatus: 'DRAFT',
    sourceType: 'LEGACY_DATA',
    sourceReviewedAt: null,
    sourceReviewState: 'UNREVIEWED',
    evidenceKind: 'SYNTHETIC_CANDIDATE',
    expectedOutputStatus: 'DRAFT',
    expectedOutput: {},
    ruleStates: ['UNREVIEWED'],
    comparisonStatuses: ['UNEXPLAINED_DIFFERENCE'],
    openTechnicalIssues: 1,
    reviewChecks: { profiles: true },
  });
  assert.ok(blockers.includes('DATASET_NOT_RELEASED'));
  assert.ok(blockers.includes('MISSING_REVIEWED_TECHNICAL_SOURCE'));
  assert.ok(blockers.includes('RULE_NOT_VERIFIED'));
  assert.ok(blockers.includes('UNEXPLAINED_CALCULATION_DIFFERENCE'));
});

test('golden fixture may verify only with reviewed source, approved rules, and explained output', () => {
  const blockers = goldenFixtureApprovalBlockers({
    status: 'TECHNICAL_REVIEW',
    actualOutput: { ok: true },
    datasetStatus: 'RELEASED',
    sourceType: 'OFFICIAL_CATALOGUE',
    sourceReviewedAt: new Date(),
    sourceReviewState: 'APPROVED',
    evidenceKind: 'REAL_MANUFACTURED',
    expectedOutputStatus: 'APPROVED',
    expectedOutput: { applicability: { cuttingAngles: false, machining: false } },
    ruleStates: ['APPROVED'],
    comparisonStatuses: ['MATCH', 'EXPLAINED_DIFFERENCE'],
    openTechnicalIssues: 0,
    reviewChecks: {
      topology: true, materialRoles: true, profileIdentity: true, profileQuantity: true, cutDimensions: true,
      glass: true, gasket: true, hardware: true, bom: true, traceProvenance: true,
    },
  });
  assert.deepEqual(blockers, []);
});

test('golden fixture checklist cannot pass with omitted required checks', () => {
  const blockers = goldenFixtureApprovalBlockers({
    status: 'TECHNICAL_REVIEW', actualOutput: { ok: true }, datasetStatus: 'RELEASED', sourceType: 'OFFICIAL_CATALOGUE',
    sourceReviewedAt: new Date(), sourceReviewState: 'APPROVED', evidenceKind: 'REAL_MANUFACTURED', expectedOutputStatus: 'APPROVED',
    expectedOutput: { applicability: { cuttingAngles: true, machining: true } }, ruleStates: ['APPROVED'], comparisonStatuses: ['MATCH'],
    openTechnicalIssues: 0, reviewChecks: { topology: true },
  });
  assert.ok(blockers.includes('TECHNICAL_REVIEW_CHECKS_INCOMPLETE'));
});
