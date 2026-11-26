// Bước 3 dữ liệu GIẢ web NPP: sửa mã đơn theo ngày lùi, kính + mã vạch, yêu cầu thanh toán từ thợ. Chỉ API tạm 3061.
import { createRequire } from 'node:module';
const require = createRequire('E:/LELOIGLOBAL_CODEX/APP EUROHOUSE/apps/api/package.json');
const { PrismaClient } = require('@prisma/client');
const API = 'http://127.0.0.1:3061/api';
const prisma = new PrismaClient();
const tokens = {};
async function call(who, method, path, body) {
  const res = await fetch(API + path, { method, headers: { 'content-type': 'application/json', 'idempotency-key': 'seed3-' + Math.random().toString(36).slice(2) + Date.now(), ...(tokens[who] ? { authorization: `Bearer ${tokens[who]}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) { console.log('FAIL', who, method, path, res.status, String(text).slice(0, 160)); return null; }
  return json;
}
async function login(who, identifier) {
  if (who === 'npp') await prisma.nppDeviceSession.deleteMany();
  let j; for (let t = 0; t < 8; t++) { const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier, password: 'Eurohouse@2026' }) }); j = await r.json(); if (r.status !== 429) break; await new Promise((x) => setTimeout(x, 20000)); }
  tokens[who] = j.user.token;
}
// 1) mã đơn theo ngày thật của đơn (tránh trùng khi tạo đơn mới hôm nay)
const orders = await prisma.order.findMany({ orderBy: { createdAt: 'asc' } });
const seen = new Map();
for (const o of orders) {
  const d = o.createdAt; const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const prefix = o.code.replace(/-\d{6}-\d+$/, '');
  const key = prefix + ymd; const n = (seen.get(key) ?? 0) + 1; seen.set(key, n);
  const code = `${prefix}-${ymd}-${String(n).padStart(2, '0')}`;
  await prisma.$executeRawUnsafe(`UPDATE "Order" SET code=$1 WHERE id=$2`, code, o.id);
  await prisma.$executeRawUnsafe(`UPDATE "Debt" SET note=$1 WHERE "orderId"=$2`, 'Công nợ đơn ' + code, o.id);
}
console.log('đã sửa mã', orders.length);

await login('npp', 'npp@eurohouse.vn');
// 2) kính: mã đầu + tồn tấm
const schemes = [['CL8', 'Cường lực 8 ly trắng', 'Kính cường lực', 8], ['CL10', 'Cường lực 10 ly trắng', 'Kính cường lực', 10], ['KT5', 'Kính trắng 5 ly', 'Kính trắng', 5], ['HH6', 'Hộp 6+9A+6', 'Kính hộp', 21]];
const sch = {};
for (const [prefix, label, glassType, thicknessMm] of schemes) { const r = await call('npp', 'POST', '/npp/glass/schemes', { prefix, label, glassType, thicknessMm }); if (r) sch[prefix] = r; }
const list = await call('npp', 'GET', '/npp/glass/schemes'); for (const s of list ?? []) sch[s.prefix] = s;
const sheets = [['CL8', 2440, 3660, 14, 'Kệ A1', 1380000], ['CL8', 1830, 2440, 8, 'Kệ A2', 760000], ['CL10', 2440, 3660, 6, 'Kệ B1', 1710000], ['KT5', 2250, 3210, 22, 'Kệ C1', 520000], ['HH6', 1500, 2200, 4, 'Kệ D1', 1450000]];
for (const [p, w, h, q, location, unitCost] of sheets) if (sch[p]) await call('npp', 'POST', '/npp/glass/stock/receive', { schemeId: sch[p].id, widthMm: w, heightMm: h, quantity: q, location, unitCost, kind: 'SHEET', note: 'Nhập lô đầu kỳ', idempotencyKey: 'gl-' + p + w + h + Math.random().toString(36).slice(2) });
// 3) yêu cầu thanh toán từ thợ (chờ NPP xác nhận)
const debts = await prisma.debt.findMany({ where: { paidAmount: 0, nppOrgId: { not: null } }, include: { factoryOrg: { include: { users: true } } }, orderBy: { createdAt: 'desc' }, take: 4 });
for (const [i, d] of debts.entries()) {
  const u = d.factoryOrg?.users?.[0]; if (!u) continue;
  await login('f' + i, u.email);
  await call('f' + i, 'POST', `/debts/${d.id}/payment-requests`, { amount: d.amount, method: i % 2 ? 'CASH' : 'BANK_TRANSFER', note: i % 2 ? 'Thợ báo đã đưa tiền mặt' : 'Đã chuyển khoản, ảnh chuyển khoản đính kèm' });
}
console.log('xong');
await prisma.$disconnect();
