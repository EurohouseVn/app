import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { BomService, assertBomRevisionMutableStatus } from './bom/bom.service';
import { CuttingEngine } from './cutting/cutting-engine';
import { DoorDesignValidator } from './design/door-design.validator';
import { FOUNDATION_GOLDEN_FIXTURES } from './golden-fixtures';
import { GeometryEngine } from './geometry/geometry-engine';
import { NestingEngine } from './nesting/nesting-engine';
import { CanonicalRuleEngine } from './rules/canonical-rule-engine';
import { versionIdentity } from './rules/version-identity';
import { MATERIAL_ROLE_BY_CODE } from './material-roles';
import { resolveMaterialRequirements } from './datasets/dataset-resolver';

test('all provisional golden fixtures validate and calculate deterministically', async () => {
  const validator = new DoorDesignValidator();
  const geometry = new GeometryEngine();
  const engine = new CanonicalRuleEngine(validator, geometry);
  for (const fixture of FOUNDATION_GOLDEN_FIXTURES) {
    const first = await engine.evaluate(fixture);
    const second = await engine.evaluate(fixture);
    assert.deepEqual(second, first);
    assert.equal(first.requirements.filter((item) => item.category === 'ALUMINIUM').length, 4);
    assert.equal(first.requirements.filter((item) => item.category === 'GLASS').length, 1);
    assert.equal(first.requirements.filter((item) => item.category === 'HARDWARE').length, 1);
  }
});

test('DoorDesign validation rejects broken topology and dimensions', () => {
  const invalid = { ...FOUNDATION_GOLDEN_FIXTURES[0], widthMm: -1, panels: [{ ...FOUNDATION_GOLDEN_FIXTURES[0].panels[0], openingId: 'missing' }] };
  const result = new DoorDesignValidator().validate(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Width')));
  assert.ok(result.errors.some((error) => error.includes('unknown opening')));
});

test('material role taxonomy separates aluminium, glass, and hardware', () => {
  assert.equal(MATERIAL_ROLE_BY_CODE.FRAME_OUTER.category, 'ALUMINIUM');
  assert.equal(MATERIAL_ROLE_BY_CODE.GLASS.category, 'GLASS');
  assert.equal(MATERIAL_ROLE_BY_CODE.HINGE.category, 'HARDWARE');
});

test('golden flow resolves generic roles into a versioned dataset before BOM creation', async () => {
  const validator = new DoorDesignValidator();
  const engine = new CanonicalRuleEngine(validator, new GeometryEngine());
  const rules = await engine.evaluate(FOUNDATION_GOLDEN_FIXTURES[0]);
  const resolved = resolveMaterialRequirements('dataset-revision-eurohouse-fixture', rules.requirements, [{
    roleCode: 'FRAME_OUTER',
    profileRevision: { id: 'profile-revision-fixture', stableKey: 'eurohouse:fixture:frame', code: 'FIXTURE-NOT-VERIFIED', stockLengthMm: 6000, kgPerMeter: 1.2 },
  }]);
  assert.equal(resolved.diagnostics.length, 0);
  assert.equal(resolved.requirements.filter((item) => item.category === 'ALUMINIUM').every((item) => item.profileRevisionId === 'profile-revision-fixture'), true);
  const lines = new BomService({} as never).toLines(resolved.requirements);
  assert.equal(lines.length, rules.requirements.length);
  assert.equal(lines[0].datasetRevisionId, 'dataset-revision-eurohouse-fixture');
});

test('linear cutting uses remnants first and accounts for kerf', () => {
  const result = new CuttingEngine().optimize(
    [{ id: 'frame', materialKey: 'FRAME_OUTER', lengthMm: 1200, quantity: 2 }],
    [{ id: 'remnant-1', materialKey: 'FRAME_OUTER', lengthMm: 2500 }],
    { stockLengthMm: 6000, kerfMm: 3, minimumReusableRemnantMm: 500 },
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].source, 'REMNANT');
  assert.equal(result[0].usedMm, 2403);
  assert.equal(result[0].wasteMm, 97);
  assert.equal(result[0].reusableRemnantMm, 0);
});

test('2D nesting places rotatable glass on a sheet', () => {
  const sheets = new NestingEngine().nest([{ id: 'glass', widthMm: 1200, heightMm: 800, quantity: 2, allowRotation: true }], { widthMm: 2440, heightMm: 1830 });
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].placements.length, 2);
});

test('released BOM revision is immutable', () => {
  assert.throws(() => assertBomRevisionMutableStatus('RELEASED'), BadRequestException);
  assert.doesNotThrow(() => assertBomRevisionMutableStatus('DRAFT'));
  assert.ok(BomService);
});

test('content based engine versions are stable and change with content', () => {
  assert.equal(versionIdentity('engine', { a: 1, b: 2 }), versionIdentity('engine', { b: 2, a: 1 }));
  assert.notEqual(versionIdentity('engine', { a: 1 }), versionIdentity('engine', { a: 2 }));
});
