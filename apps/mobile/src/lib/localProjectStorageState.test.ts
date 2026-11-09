import assert from 'node:assert/strict';
import test from 'node:test';
import { localProjectStorageKey } from './localProjectStorageState';

test('isolates the local project replica and mutation queue by signed-in account', () => {
  assert.notEqual(
    localProjectStorageKey('@eurohouse_project_replica_v2', 'user-a'),
    localProjectStorageKey('@eurohouse_project_replica_v2', 'user-b'),
  );
  assert.equal(
    localProjectStorageKey('@eurohouse_operations_mutation_queue', 'user-a'),
    '@eurohouse_operations_mutation_queue:user-a',
  );
});

test('uses an anonymous scope before authentication is ready', () => {
  assert.equal(
    localProjectStorageKey('@eurohouse_project_replica_v2', null),
    '@eurohouse_project_replica_v2:anonymous',
  );
});
