const { executeSql, loadLocalEnv, prisma, schemaUrl } = require('./migration-utils.cjs');

loadLocalEnv();
const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) throw new Error('DATABASE_URL is required for disposable migration verification.');
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const freshSchema = `phase0_fresh_${suffix}`;
const adoptSchema = `phase0_adopt_${suffix}`;

function cleanup(schema) {
  executeSql(baseUrl, `DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
}

try {
  executeSql(baseUrl, `CREATE SCHEMA "${freshSchema}"; CREATE SCHEMA "${adoptSchema}";`);
  const freshUrl = schemaUrl(baseUrl, freshSchema);
  prisma(['migrate', 'deploy'], { env: { DATABASE_URL: freshUrl } });
  prisma(['migrate', 'diff', '--from-url', freshUrl, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], { env: { DATABASE_URL: freshUrl } });
  console.log('Fresh database migration path verified.');

  const adoptUrl = schemaUrl(baseUrl, adoptSchema);
  prisma(['db', 'push', '--schema', 'prisma/baselines/20260929_runtime_actual.prisma', '--skip-generate', '--accept-data-loss'], { env: { DATABASE_URL: adoptUrl } });
  const executable = process.platform === 'win32' ? 'node.exe' : 'node';
  const { spawnSync } = require('child_process');
  const result = spawnSync(executable, ['scripts/adopt-migration-baseline.cjs', '--confirm-adopt-existing-database', '--through=20260929093000_pre_v2_schema_reconciliation'], { cwd: require('./migration-utils.cjs').apiRoot, env: { ...process.env, DATABASE_URL: adoptUrl }, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Existing database baseline adoption simulation failed.');
  prisma(['migrate', 'deploy'], { env: { DATABASE_URL: adoptUrl } });
  prisma(['migrate', 'diff', '--from-url', adoptUrl, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], { env: { DATABASE_URL: adoptUrl } });
  console.log('Existing database adoption path verified.');
} finally {
  cleanup(freshSchema);
  cleanup(adoptSchema);
}
