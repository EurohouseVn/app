import assert from 'node:assert/strict';
import test from 'node:test';
import { organizationInitials, projectCodeDate, nextProjectCode } from './project-code';

test('builds a Vietnamese workshop abbreviation from its production name', () => {
  assert.equal(organizationInitials('NHÔM KÍNH HUÂN HUYỀN'), 'NKHH');
  assert.equal(organizationInitials('X.MinhViet'), 'XMV');
});

test('formats project dates in Vietnam as YYMMDD', () => {
  assert.equal(projectCodeDate(new Date('2026-10-19T18:30:00.000Z')), '261020');
});

test('creates a daily workshop sequence without reusing archived project codes', async () => {
  const database = {
    organization: {
      findUnique: async () => ({ shortLabel: null, productionName: 'NHÔM KÍNH HUÂN HUYỀN', name: 'Nhôm Kính Huân Huyền', code: 'CSSX-HH' }),
    },
    project: {
      findMany: async () => [
        { code: 'CT-261020-NKHH-01' },
        { code: 'CT-261020-NKHH-03' },
      ],
    },
  };

  assert.equal(
    await nextProjectCode(database, 'org-hh', new Date('2026-10-20T04:00:00.000Z')),
    'CT-261020-NKHH-04',
  );
});
