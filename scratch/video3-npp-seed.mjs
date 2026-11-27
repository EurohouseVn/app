// Dữ liệu GIẢ cho video giới thiệu web NPP. Chỉ chạy với API tạm cổng 3061 + CSDL tạm 55471.
import { createRequire } from 'node:module';
const require = createRequire('E:/LELOIGLOBAL_CODEX/APP EUROHOUSE/apps/api/package.json');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const API = 'http://127.0.0.1:3061/api';
const PASS = 'Eurohouse@2026';
const prisma = new PrismaClient();
const tokens = {};
async function call(who, method, path, body) {
  const res = await fetch(API + path, { method, headers: { 'content-type': 'application/json', 'idempotency-key': 'seed-' + Math.random().toString(36).slice(2) + Date.now(), ...(tokens[who] ? { authorization: `Bearer ${tokens[who]}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) { console.log('FAIL', who, method, path, res.status, String(text).slice(0, 160)); return null; }
  return json;
}
async function login(who, identifier) { if (who === 'npp') await prisma.nppDeviceSession.deleteMany(); let r, j; for (let t = 0; t < 8; t++) { r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier, password: PASS }) }); j = await r.json(); if (r.status !== 429) break; await new Promise((x) => setTimeout(x, 20000)); } if (!j.user) throw new Error('login ' + identifier + ' ' + JSON.stringify(j)); tokens[who] = j.user.token; return j.user; }
await prisma.user.updateMany({ where: { email: { in: ['npp@eurohouse.vn', 'tho@eurohouse.vn'] } }, data: { verifiedAt: new Date() } });
await login('npp', 'npp@eurohouse.vn');
const npp = await prisma.organization.findUnique({ where: { code: 'NPP-01' } });
await prisma.organization.update({ where: { id: npp.id }, data: { name: 'NPP Nhôm Miền Nam', address: '128 Quốc lộ 1A, P. An Phú Đông, Q.12, TP.HCM', phone: '0902 333 444' } });

// --- Xưởng / thợ do NPP quản lý
const factoryDefs = [
  ['Xưởng nhôm kính Hùng Phát', 'Anh Hùng', 'hungphat', 'Q. Bình Tân'],
  ['Cơ khí nhôm Thành Đạt', 'Anh Đạt', 'thanhdat', 'TP. Thủ Đức'],
  ['Nhôm kính Minh Khang', 'Anh Khang', 'minhkhang', 'Q. Gò Vấp'],
  ['Xưởng cửa Tâm An', 'Chị Tâm', 'taman', 'Hóc Môn'],
  ['Nhôm kính Long Phát', 'Anh Long', 'longphat', 'Bình Dương'],
];
const hash = await bcrypt.hash(PASS, 10);
const factories = [];
for (const [name, contact, key, area] of factoryDefs) {
  let f = await prisma.organization.findFirst({ where: { name } });
  if (!f) f = await prisma.organization.create({ data: { code: 'XUONG-' + key.toUpperCase(), name, type: 'FACTORY', shortLabel: key.slice(0, 8), phone: '09' + Math.floor(10000000 + Math.random() * 89999999), address: area, managedByNppId: npp.id } });
  const email = `${key}@eurohouse.vn`;
  const u = await prisma.user.upsert({ where: { email }, update: { passwordHash: hash, verifiedAt: new Date(), emailNormalized: email }, create: { email, emailNormalized: email, displayName: contact, passwordHash: hash, role: 'FACTORY', organizationId: f.id, verifiedAt: new Date() } });
  factories.push({ org: f, email, user: u, key });
}
const nppUser = await prisma.user.findUnique({ where: { email: 'npp@eurohouse.vn' } });
const allOrgs = [...factories.map((f) => f.org), await prisma.organization.findUnique({ where: { code: 'XUONG-01' } })];
for (const org of allOrgs) for (const featureKey of ['FORMULA_CUTTING', 'EUROHOUSE_ORDERING']) await prisma.eurohouseFeatureGrant.upsert({ where: { organizationId_featureKey: { organizationId: org.id, featureKey } }, update: { status: 'ACTIVE' }, create: { organizationId: org.id, featureKey, status: 'ACTIVE', source: 'NPP_DIRECT', nppOrganizationId: npp.id, activatedByUserId: nppUser.id } });
console.log('xưởng', factories.length);

// --- Catalog
const systems = await call('npp', 'GET', '/catalog/systems');
const pick = (sysCode, codes) => systems.find((s) => s.code === sysCode).profiles.filter((p) => codes.includes(p.code));
const PROFILES = [
  ...pick('EU-70', ['C3225', 'C3296', 'E701A', 'E702', 'E704A', 'E705', 'E706', 'E70D110', 'E70D150']),
  ...pick('EU-55', ['C3300', 'C3326', 'CN55']),
  ...pick('EU-TRUOT', ['KH-K9809', 'KH-K9810', 'KH-K9812']),
  ...pick('EU-PRECO', ['C3202', 'C3203', 'C3209']),
];
const COLORS = ['CAFE_METALIC', 'XAM_NGOC_TRAI', 'CAFE_THUONG', 'VAN_GO_CAM_LAI'];
console.log('mã cây', PROFILES.length);

// --- Tồn kho nhôm của NPP (số cây nguyên 6m)
const stockPlan = (p, ci) => {
  const base = { C3225: 160, C3296: 140, E701A: 90, E702: 120, E704A: 60, E705: 75, E706: 85, E70D110: 40, E70D150: 70 }[p.code] ?? 70;
  const factor = [1, 0.7, 0.45, 0.25][ci];
  return Math.round(base * factor);
};
const haveStock = await prisma.nppStockMovement.count();
for (const p of haveStock ? [] : PROFILES) {
  for (const [ci, color] of COLORS.entries()) {
    let q = stockPlan(p, ci);
    if (p.code === 'E704A' && color === 'CAFE_METALIC') q = 7; // sắp hết để minh hoạ cảnh báo
    if (p.code === 'E701A' && color === 'CAFE_METALIC') q = 18;
    await call('npp', 'POST', `/npp/inventory/profiles/${p.id}/stock-adjust`, { direction: 'IN', quantity: q, colorCode: color, reason: 'Nhập từ Công ty', note: 'Lô nhập đầu kỳ' });
  }
}
console.log('tồn kho xong');

// --- Đơn lịch sử: 6 tháng, hoàn tất, có công nợ
const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const PRICE = 146000;
async function makeOrder(f, items, cust, addr) {
  if (!tokens[f.key]) await login(f.key, f.email);
  const o = await call(f.key, 'POST', '/orders', { sourceType: 'FACTORY', clientRequestId: 'seed-' + Math.random().toString(36).slice(2), submitToNpp: true, colorCode: [...new Set(items.map((i) => i.colorCode))].join(', '), customerName: cust, deliveryAddress: addr, items: items.map((i) => ({ profileId: i.p.id, productCode: i.p.code, productName: i.p.name, colorCode: i.colorCode, quantity: i.q })) });
  return o;
}
const customers = ['Anh Nguyễn Văn Thành', 'Chị Lê Thị Mai', 'Anh Phạm Quốc Việt', 'Chị Trần Ngọc Hà', 'Anh Võ Minh Quân', 'Chị Đặng Thu Trang'];
const done = [];
const ago = (d) => new Date(Date.now() - d * 86400000);
for (let i = 0; i < 28; i++) {
  const f = factories[i % factories.length];
  const n = rnd(2, 4); const items = [];
  for (let k = 0; k < n; k++) items.push({ p: PROFILES[rnd(0, PROFILES.length - 1)], colorCode: COLORS[rnd(0, 2)], q: rnd(6, 24) });
  const o = await makeOrder(f, items, customers[i % customers.length], 'Công trình ' + (i + 1));
  if (!o) continue;
  const order = await call('npp', 'GET', `/npp/orders/${o.id}`);
  const theo = order.theoreticalTotalKg || order.totalKg;
  await call('npp', 'POST', `/npp/orders/${o.id}/receive`);
  const actual = Math.round((theo * (1.015 + Math.random() * 0.02)) * 100) / 100;
  const r = await call('npp', 'POST', `/npp/orders/${o.id}/delivery`, { actualTotalKg: actual, finalUnitPricePerKg: PRICE - (i % 3) * 500, discountAmount: 0, surchargeAmount: 0 });
  if (!r) continue;
  await call('npp', 'POST', `/npp/orders/${o.id}/complete`);
  done.push({ id: o.id, ageDays: 5 + Math.floor((27 - i) * 6.2) });
}
console.log('đơn hoàn tất', done.length);
// lùi ngày cho báo cáo theo tháng
for (const d of done) {
  const dt = ago(d.ageDays);
  await prisma.$executeRawUnsafe(`UPDATE "Order" SET "createdAt"=$1, "updatedAt"=$1 WHERE id=$2`, dt, d.id);
  await prisma.$executeRawUnsafe(`UPDATE "Debt" SET "createdAt"=$1 WHERE "orderId"=$2`, dt, d.id);
  await prisma.$executeRawUnsafe(`UPDATE "OrderStatusHistory" SET "createdAt"=$1 WHERE "orderId"=$2`, dt, d.id);
}
// thu một phần công nợ cũ
const debts = await call('npp', 'GET', '/npp/debts');
let idx = 0;
for (const d of debts) {
  idx++;
  const age = (Date.now() - new Date(d.createdAt).getTime()) / 86400000;
  if (age > 60) await call('npp', 'POST', `/npp/debts/${d.id}/payments`, { amount: d.amount, method: 'BANK_TRANSFER' });
  else if (age > 30 && idx % 2) await call('npp', 'POST', `/npp/debts/${d.id}/payments`, { amount: Math.round(d.amount * 0.6 / 1000) * 1000, method: 'CASH' });
}

// --- Hai đơn mới chờ NPP (để quay màn hình)
const A = factories[1], B = factories[3];
await makeOrder(A, [{ p: PROFILES[2], colorCode: 'CAFE_METALIC', q: 30 }, { p: PROFILES[3], colorCode: 'CAFE_METALIC', q: 24 }, { p: PROFILES[0], colorCode: 'XAM_NGOC_TRAI', q: 40 }], 'Chị Lê Thị Mai', '12 Hồ Học Lãm, Q. Bình Tân');
await makeOrder(B, [{ p: PROFILES[4], colorCode: 'CAFE_METALIC', q: 20 }, { p: PROFILES[1], colorCode: 'CAFE_THUONG', q: 36 }], 'Anh Phạm Quốc Việt', 'Sunrise City, Q.7');

// --- Kính + phụ kiện
const accs = [['Bản lề 3D inox', 'Kinlong', 'Bản lề', 'bộ', 185000, 120], ['Khóa đa điểm cửa đi', 'Kinlong', 'Khóa', 'bộ', 640000, 45], ['Tay nắm cửa đi 2 mặt', 'Hafele', 'Tay nắm', 'bộ', 420000, 60], ['Ron EPDM đen', 'Eurohouse', 'Ron', 'cuộn', 380000, 80], ['Silicone trung tính', 'Apollo', 'Keo', 'chai', 52000, 300]];
for (const [name, brand, category, unit, unitCost, quantity] of accs) await call('npp', 'POST', '/npp/accessories', { name, brand, category, unit, unitCost, quantity });
// Bảng giá niêm yết theo màu (đ/kg): giá bó nguyên và giá nhôm trần. Số liệu minh hoạ cho video.
const colorPrices = [['CAFE_METALIC', 144000, 150000], ['XAM_NGOC_TRAI', 152000, 158000], ['VAN_GO_CAM_LAI', 172000, 178000], ['CAFE_THUONG', 138000, 144000], ['VAN_GO_OLAK', 168000, 174000], ['XAM_RITA', 150000, 156000]];
await call('npp', 'PUT', '/npp/color-prices', { prices: colorPrices.map(([colorCode, bundlePricePerKg, barePricePerKg]) => ({ colorCode, bundlePricePerKg, barePricePerKg })) });
await prisma.$disconnect();
console.log('xong');
