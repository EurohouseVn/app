// Bước 2 dữ liệu GIẢ web NPP: hoàn tất đơn còn treo, lùi ngày, ghi thu công nợ, chuẩn hoá tồn kho. Chỉ API tạm 3061.
import { createRequire } from 'node:module';
const require = createRequire('E:/LELOIGLOBAL_CODEX/APP EUROHOUSE/apps/api/package.json');
const { PrismaClient } = require('@prisma/client');
const API = 'http://127.0.0.1:3061/api';
const prisma = new PrismaClient();
let token = '';
async function call(method, path, body) {
  const res = await fetch(API + path, { method, headers: { 'content-type': 'application/json', 'idempotency-key': 'seed2-' + Math.random().toString(36).slice(2) + Date.now(), authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) { console.log('FAIL', method, path, res.status, String(text).slice(0, 160)); return null; }
  return json;
}
await prisma.nppDeviceSession.deleteMany();
const lg = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: 'npp@eurohouse.vn', password: 'Eurohouse@2026' }) })).json();
token = lg.user.token;
await prisma.$executeRawUnsafe(`UPDATE "NppProfileStock" SET "stockBars"="stockBars"+500`);
const stuck = await prisma.order.findMany({ where: { status: 'NPP_REVIEWING' }, orderBy: { createdAt: 'asc' } });
const ages = [175, 150, 128, 105, 83, 66, 52, 38, 27, 19, 11, 4];
let n = 0;
for (const [i, o] of stuck.entries()) {
  const theo = o.theoreticalTotalKg || o.totalKg;
  const actual = Math.round(theo * (1.012 + (i % 4) * 0.006) * 100) / 100;
  const r = await call('POST', `/npp/orders/${o.id}/delivery`, { actualTotalKg: actual, finalUnitPricePerKg: 87500 - (i % 3) * 500 });
  if (!r) continue;
  await call('POST', `/npp/orders/${o.id}/complete`);
  const dt = new Date(Date.now() - ages[i % ages.length] * 86400000);
  await prisma.$executeRawUnsafe(`UPDATE "Order" SET "createdAt"=$1,"updatedAt"=$1 WHERE id=$2`, dt, o.id);
  await prisma.$executeRawUnsafe(`UPDATE "Debt" SET "createdAt"=$1 WHERE "orderId"=$2`, dt, o.id);
  await prisma.$executeRawUnsafe(`UPDATE "OrderStatusHistory" SET "createdAt"=$1 WHERE "orderId"=$2`, dt, o.id);
  n++;
}
console.log('hoàn tất thêm', n);
// thu công nợ cũ theo tuổi
const rows = await prisma.debt.findMany({ where: { nppOrgId: { not: null } }, orderBy: { createdAt: 'asc' } });
let k = 0;
for (const d of rows) {
  k++;
  const age = (Date.now() - d.createdAt.getTime()) / 86400000;
  if (age > 60) await call('POST', `/npp/debts/${d.id}/payments`, { amount: d.amount, method: 'BANK_TRANSFER' });
  else if (age > 25 && k % 2) await call('POST', `/npp/debts/${d.id}/payments`, { amount: Math.round(d.amount * 0.6 / 1000) * 1000, method: 'CASH' });
}
// tồn kho về mức trình diễn
const stocks = await prisma.nppProfileStock.findMany({ include: { profile: true } });
for (const s of stocks) {
  const base = { C3225: 160, C3296: 140, E701A: 96, E702: 120, E704A: 60, E705: 75, E706: 85, E70D110: 40 }[s.profile.code] ?? 70;
  const idx = ['CAFE_METALIC', 'XAM_NGOC_TRAI', 'CAFE_THUONG', 'VAN_GO_CAM_LAI'].indexOf(s.colorCode);
  let q = Math.round(base * [1, 0.7, 0.45, 0.25][Math.max(0, idx)]);
  if (s.profile.code === 'E704A' && s.colorCode === 'CAFE_METALIC') q = 7;
  await prisma.nppProfileStock.update({ where: { id: s.id }, data: { stockBars: q } });
}
const left = await prisma.order.count({ where: { status: { not: 'COMPLETED' } } });
console.log('đơn chưa hoàn tất', left);
await prisma.$disconnect();
