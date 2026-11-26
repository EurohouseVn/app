import { createRequire } from 'node:module';
const require = createRequire('E:/LELOIGLOBAL_CODEX/APP EUROHOUSE/apps/api/package.json');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const code = 'XUONG-HUNGPHAT-261126-01';
const o = await prisma.order.findUnique({ where: { code } });
if (o) {
  const id = o.id;
  for (const q of [
    `DELETE FROM "DebtPayment" WHERE "debtId" IN (SELECT id FROM "Debt" WHERE "orderId"='${id}')`,
    `DELETE FROM "DebtPaymentRequest" WHERE "debtId" IN (SELECT id FROM "Debt" WHERE "orderId"='${id}')`,
    `DELETE FROM "Debt" WHERE "orderId"='${id}'`,
    `DELETE FROM "PointLedger" WHERE "refId"='${id}'`,
    `DELETE FROM "NppStockMovement" WHERE "orderId"='${id}'`,
    `DELETE FROM "Order" WHERE id='${id}'`,
  ]) { try { await prisma.$executeRawUnsafe(q); } catch (e) { console.log('skip', q.slice(0, 50), String(e.message).split('\n').pop().slice(0, 120)); } }
}
console.log('còn', await prisma.order.count({ where: { code } }));
await prisma.$disconnect();
