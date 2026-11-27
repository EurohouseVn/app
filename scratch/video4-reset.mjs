// Xoá các đơn thử của hungphat hôm nay và đưa tồn kho NPP về mức trình diễn. Chỉ CSDL tạm 55471.
import { createRequire } from 'node:module';
const require = createRequire('E:/LELOIGLOBAL_CODEX/APP EUROHOUSE/apps/api/package.json');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const today = await prisma.order.findMany({ where: { code: { startsWith: 'XUONG-HUNGPHAT-' + new Date().toISOString().slice(2, 4) }, createdAt: { gte: new Date(Date.now() - 6 * 3600000) } } });
for (const o of today) for (const q of [`DELETE FROM "Debt" WHERE "orderId"='${o.id}'`, `DELETE FROM "PointLedger" WHERE "refId"='${o.id}'`, `DELETE FROM "NppStockMovement" WHERE "orderId"='${o.id}'`, `DELETE FROM "Order" WHERE id='${o.id}'`]) { try { await prisma.$executeRawUnsafe(q); } catch (e) { console.log('skip', String(e.message).split('\n').pop().slice(0, 100)); } }
console.log('đã xoá', today.length, 'đơn thử');
const stocks = await prisma.nppProfileStock.findMany({ include: { profile: true } });
for (const s of stocks) {
  const base = { C3225: 160, C3296: 140, E701A: 96, E702: 120, E704A: 60, E705: 75, E706: 85, E70D110: 40, E70D150: 70 }[s.profile.code] ?? 70;
  const idx = ['CAFE_METALIC', 'XAM_NGOC_TRAI', 'CAFE_THUONG', 'VAN_GO_CAM_LAI'].indexOf(s.colorCode);
  let q = Math.round(base * [1, 0.7, 0.45, 0.25][Math.max(0, idx)]);
  if (s.profile.code === 'E704A' && s.colorCode === 'CAFE_METALIC') q = 7;
  await prisma.nppProfileStock.update({ where: { id: s.id }, data: { stockBars: q } });
}
console.log('tồn kho đã chuẩn hoá', stocks.length);
await prisma.$disconnect();
