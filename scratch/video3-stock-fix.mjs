import { createRequire } from 'node:module';
const require = createRequire('E:/LELOIGLOBAL_CODEX/APP EUROHOUSE/apps/api/package.json');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const want = { E70D110: 40, E70D150: 70, E701A: 96, E704A: 7 };
const rows = await prisma.nppProfileStock.findMany({ where: { colorCode: 'CAFE_METALIC', profile: { code: { in: Object.keys(want) } } }, include: { profile: true, nppOrg: true } });
for (const r of rows) { if (r.stockBars !== want[r.profile.code]) { await prisma.nppProfileStock.update({ where: { id: r.id }, data: { stockBars: want[r.profile.code] } }); } }
console.log((await prisma.nppProfileStock.findMany({ where: { colorCode: 'CAFE_METALIC', profile: { code: { in: Object.keys(want) } } }, include: { profile: true } })).map((s) => s.profile.code + ':' + s.stockBars).join(' '));
await prisma.$disconnect();
