import test from 'node:test';
import assert from 'node:assert/strict';
import type { JwtUser } from '../../auth/current-user.decorator';
import {
  assertInstallationCanComplete,
  assertInstallationTransition,
  assertOrganizationOwnership,
  assertPriceBookVersionCanActivate,
  assertQcCompletion,
  assertQcFailureEvidence,
  assertQcRequiredChecks,
  installationChecklistComplete,
  assertQrEntityAuthorized,
  assertRemnantTransition,
  assertWarrantyAssetAccess,
  assertWarrantyTransition,
  assertWorkOrderTransition,
  assertWorkspaceCapability,
  calculateQuickQuoteLines,
  eventRetryDelayMs,
  eventShouldDeadLetter,
  inventoryBalance,
  mediaDeduplicationKey,
  nextPriceBookVersion,
  organizationScope,
  resolveOfflineMutation,
  workspaceCapabilities,
} from './workshop-operations.rules';
import { workshopOperationsFeatureFlags } from './workshop-operations.feature-flags';

const factoryUser: JwtUser = {
  sub: 'user-a',
  email: 'a@example.com',
  role: 'FACTORY',
  organizationId: 'org-a',
};

test('tenant isolation rejects cross-organization access', () => {
  assert.equal(organizationScope(factoryUser), 'org-a');
  assert.throws(() => organizationScope(factoryUser, 'org-b'));
  assert.throws(() => assertOrganizationOwnership('org-b', 'org-a'));
});

test('admin must choose a tenant before accessing operations', () => {
  const admin = { ...factoryUser, role: 'ADMIN' as const, organizationId: undefined };
  assert.throws(() => organizationScope(admin));
  assert.equal(organizationScope(admin, 'org-a'), 'org-a');
  assert.equal(organizationScope({ ...admin, organizationId: 'admin-org' }, 'org-a'), 'org-a');
});

test('inventory ledger preserves physical balance semantics', () => {
  assert.equal(inventoryBalance([
    { transactionType: 'RECEIVE', quantity: 10 },
    { transactionType: 'RESERVE', quantity: 3 },
    { transactionType: 'ISSUE', quantity: 4 },
    { transactionType: 'RETURN', quantity: 1 },
    { transactionType: 'ADJUST', quantity: 1, adjustmentDelta: -0.5 },
  ]), 6.5);
  assert.throws(() => inventoryBalance([{ transactionType: 'ISSUE', quantity: 0 }]));
});

test('remnant lifecycle blocks resurrection after consumption', () => {
  assert.doesNotThrow(() => assertRemnantTransition('AVAILABLE', 'RESERVED'));
  assert.doesNotThrow(() => assertRemnantTransition('RESERVED', 'CONSUMED'));
  assert.throws(() => assertRemnantTransition('CONSUMED', 'AVAILABLE'));
});

test('PriceBook versioning is monotonic and rejects expired versions', () => {
  assert.equal(nextPriceBookVersion([]), 1);
  assert.equal(nextPriceBookVersion([1, 3, 2]), 4);
  assert.throws(() => assertPriceBookVersionCanActivate({ validTo: new Date('2026-01-01') }, new Date('2026-09-30')));
  assert.throws(() => assertPriceBookVersionCanActivate({ validFrom: new Date('2027-02-01'), validTo: new Date('2027-01-01') }));
});

test('quick quote calculates commercial area without claiming exact BOM', () => {
  const [line] = calculateQuickQuoteLines([{ lineType: 'AREA', quantity: 1, unitPrice: 1_500_000, widthMm: 1000, heightMm: 2000 }]);
  assert.equal(line.calculatedQuantity, 2);
  assert.equal(line.total, 3_000_000);
});

test('Project and Opening ownership share the same tenant boundary', () => {
  assert.doesNotThrow(() => assertOrganizationOwnership('org-a', organizationScope(factoryUser)));
  assert.throws(() => assertOrganizationOwnership('org-b', organizationScope(factoryUser)));
});

test('generic work-order transitions are explicit and terminal states stay terminal', () => {
  assert.doesNotThrow(() => assertWorkOrderTransition('DRAFT', 'READY'));
  assert.doesNotThrow(() => assertWorkOrderTransition('IN_PROGRESS', 'PAUSED'));
  assert.doesNotThrow(() => assertWorkOrderTransition('PAUSED', 'IN_PROGRESS'));
  assert.throws(() => assertWorkOrderTransition('DONE', 'IN_PROGRESS'));
});

test('QC completion accepts only explicit PASS, FAIL or REWORK values', () => {
  assert.doesNotThrow(() => assertQcCompletion([{ result: 'PASS' }, { result: 'REWORK' }]));
  assert.throws(() => assertQcCompletion([]));
  assert.throws(() => assertQcCompletion([{ result: 'SKIPPED' }]));
  assert.doesNotThrow(() => assertQcRequiredChecks(
    ['DIMENSION', 'SURFACE'],
    [{ checkKey: 'DIMENSION', result: 'PASS' }, { checkKey: 'SURFACE', result: 'REWORK' }],
  ));
  assert.throws(() => assertQcRequiredChecks(
    ['DIMENSION', 'SURFACE'],
    [{ checkKey: 'DIMENSION', result: 'PASS' }],
  ));
  assert.doesNotThrow(() => assertQcFailureEvidence([{ result: 'PASS' }]));
  assert.throws(() => assertQcFailureEvidence([{ result: 'REWORK' }]));
  assert.doesNotThrow(() => assertQcFailureEvidence([{ result: 'FAIL' }], ['photo-1']));
});

test('installation requires acceptance and customer signature before completion', () => {
  assert.doesNotThrow(() => assertInstallationTransition('SCHEDULED', 'EN_ROUTE'));
  assert.throws(() => assertInstallationTransition('SCHEDULED', 'COMPLETED'));
  assert.throws(() => assertInstallationCanComplete({ status: 'ACCEPTED', acceptedAt: new Date() }));
  assert.doesNotThrow(() => assertInstallationCanComplete({ status: 'ACCEPTED', acceptedAt: new Date(), customerSignatureObjectId: 'sig-1' }));
  assert.throws(() => assertInstallationCanComplete({ status: 'ACCEPTED', acceptedAt: new Date(), customerSignatureObjectId: 'sig-1', requiredPhotoCount: 2, photoObjectIds: ['one'] }));
  assert.throws(() => assertInstallationCanComplete({ status: 'ACCEPTED', acceptedAt: new Date(), customerSignatureObjectId: 'sig-1', qcPassed: false }));
  assert.doesNotThrow(() => assertInstallationCanComplete({ status: 'ACCEPTED', acceptedAt: new Date(), requiresCustomerSignature: false, requiredPhotoCount: 1, photoObjectIds: ['photo-1'], qcPassed: true }));
  assert.throws(() => assertInstallationCanComplete({ status: 'ACCEPTED', acceptedAt: new Date(), customerSignatureObjectId: 'sig-1', materialsChecklistComplete: false }));
  assert.throws(() => assertInstallationCanComplete({ status: 'ACCEPTED', acceptedAt: new Date(), customerSignatureObjectId: 'sig-1', toolsChecklistComplete: false }));
  assert.equal(installationChecklistComplete(null), true);
  assert.equal(installationChecklistComplete([{ label: 'Máy khoan', required: true, checked: true }]), true);
  assert.equal(installationChecklistComplete([{ label: 'Máy khoan', required: true, checked: false }]), false);
});

test('warranty and QR access reject foreign tenant identities', () => {
  assert.doesNotThrow(() => assertWarrantyAssetAccess('org-a', 'org-a'));
  assert.throws(() => assertWarrantyAssetAccess('org-b', 'org-a'));
  assert.doesNotThrow(() => assertQrEntityAuthorized('org-a', 'org-a'));
  assert.throws(() => assertQrEntityAuthorized('org-b', 'org-a'));
  assert.doesNotThrow(() => assertWarrantyTransition('OPEN', 'SCHEDULED'));
  assert.throws(() => assertWarrantyTransition('OPEN', 'CLOSED', 'Đã xử lý'));
  assert.throws(() => assertWarrantyTransition('IN_PROGRESS', 'RESOLVED'));
  assert.doesNotThrow(() => assertWarrantyTransition('IN_PROGRESS', 'RESOLVED', 'Căn chỉnh bản lề'));
});

test('global search tenant scope cannot be overridden by a factory user', () => {
  assert.equal(organizationScope(factoryUser, 'org-a'), 'org-a');
  assert.throws(() => organizationScope(factoryUser, 'org-b'));
});

test('offline mutations detect stale base revisions and allow idempotent current revisions', () => {
  assert.equal(resolveOfflineMutation(3, 3), 'APPLY');
  assert.equal(resolveOfflineMutation(3, undefined), 'APPLY');
  assert.equal(resolveOfflineMutation(3, 2), 'CONFLICT');
});

test('Track A feature flags default off', () => {
  assert.deepEqual(workshopOperationsFeatureFlags({} as NodeJS.ProcessEnv), {
    survey: false,
    inventory: false,
    shopFloor: false,
    quality: false,
    installation: false,
    warranty: false,
  });
});

test('workspace roles expose different server-enforced capabilities', () => {
  assert.ok(workspaceCapabilities('OWNER').includes('master.manage'));
  assert.ok(workspaceCapabilities('WORKER').includes('work.execute'));
  assert.ok(!workspaceCapabilities('WORKER').includes('inventory.manage'));
  assert.doesNotThrow(() => assertWorkspaceCapability('INSTALLER', 'installation.execute'));
  assert.throws(() => assertWorkspaceCapability('WORKER', 'warranty.manage'));
});

test('event retry uses bounded exponential backoff and dead-letter threshold', () => {
  assert.equal(eventRetryDelayMs(1), 5_000);
  assert.equal(eventRetryDelayMs(3), 20_000);
  assert.equal(eventRetryDelayMs(99), 3_600_000);
  assert.equal(eventShouldDeadLetter(4), false);
  assert.equal(eventShouldDeadLetter(5), true);
});

test('media deduplication key is tenant and entity scoped', () => {
  const first = mediaDeduplicationKey({ organizationId: 'org-a', checksum: 'abc', entityType: 'OPENING', entityId: 'one' });
  const same = mediaDeduplicationKey({ organizationId: 'org-a', checksum: 'abc', entityType: 'OPENING', entityId: 'one' });
  const otherTenant = mediaDeduplicationKey({ organizationId: 'org-b', checksum: 'abc', entityType: 'OPENING', entityId: 'one' });
  assert.equal(first, same);
  assert.notEqual(first, otherTenant);
});
