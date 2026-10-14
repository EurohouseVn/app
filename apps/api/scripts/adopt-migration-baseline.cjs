const fs = require('fs');
const path = require('path');
const { apiRoot, loadLocalEnv, prisma } = require('./migration-utils.cjs');

loadLocalEnv();
if (!process.argv.includes('--confirm-adopt-existing-database')) {
  throw new Error('Refusing to modify migration history without --confirm-adopt-existing-database.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const throughArg = process.argv.find((arg) => arg.startsWith('--through='));
const through = throughArg?.slice('--through='.length) ?? '20260929093000_pre_v2_schema_reconciliation';
const baseline = path.join(apiRoot, 'prisma', 'baselines', '20260929_runtime_actual.prisma');
const parity = prisma(['migrate', 'diff', '--from-url', process.env.DATABASE_URL, '--to-schema-datamodel', baseline, '--exit-code'], { capture: true });
if (parity.status !== 0) {
  process.stderr.write(parity.stdout ?? '');
  process.stderr.write(parity.stderr ?? '');
  throw new Error('Existing database does not match the audited pre-V2.1 baseline. Migration history was not changed.');
}
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');
const migrations = fs.readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name <= through)
  .map((entry) => entry.name)
  .sort();
for (const migration of migrations) {
  const result = prisma(['migrate', 'resolve', '--applied', migration], { capture: true });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0 && !/already recorded as applied/i.test(output)) {
    process.stderr.write(output);
    throw new Error(`Could not record migration ${migration}.`);
  }
  console.log(`Baseline recorded: ${migration}`);
}
console.log('Baseline adoption complete. Run prisma migrate deploy to apply post-baseline migrations.');
