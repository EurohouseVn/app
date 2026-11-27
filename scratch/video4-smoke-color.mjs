// Kiểm thử nhanh luồng cân theo màu trên API tạm 3061. Đơn thử được xoá cuối script bằng video3-reset-demo.
const R = 'http://127.0.0.1:3061/api';
const j = async (m, p, t, b, extra = {}) => { const r = await fetch(R + p, { method: m, headers: { 'content-type': 'application/json', authorization: `Bearer ${t}`, ...extra }, body: b ? JSON.stringify(b) : undefined }); const x = await r.text(); try { return { s: r.status, d: JSON.parse(x) }; } catch { return { s: r.status, d: x }; } };
const login = async (id) => (await (await fetch(R + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: id, password: 'Eurohouse@2026' }) })).json()).user.token;
const TF = await login('hungphat@eurohouse.vn'), TN = await login('npp@eurohouse.vn');
const sys = (await j('GET', '/catalog/systems', TF)).d.find((s) => s.code === 'EU-70');
const pr = Object.fromEntries(sys.profiles.map((p) => [p.code, p]));
const items = [];
for (const c of ['CAFE_METALIC', 'XAM_NGOC_TRAI', 'VAN_GO_CAM_LAI']) for (const [code, q] of [['E701A', 10], ['E70D110', 8], ['E70D150', 6]]) items.push({ profileId: pr[code].id, productCode: code, productName: pr[code].name, colorCode: c, quantity: q });
const o = (await j('POST', '/orders', TF, { sourceType: 'FACTORY', clientRequestId: 'smoke-' + Date.now(), submitToNpp: true, customerName: 'Test', items })).d;
console.log('order', o.code, 'kg', o.totalKg);
await j('POST', `/npp/orders/${o.id}/receive`, TN);
const d1 = await j('POST', `/npp/orders/${o.id}/delivery`, TN, { colorLines: [{ colorCode: 'CAFE_METALIC', basis: 'BUNDLE', actualKg: 270, unitPricePerKg: 144000 }] }, { 'idempotency-key': 'smoke-a-' + Date.now() });
console.log('thiếu màu ->', d1.s, d1.d.message);
const d2 = await j('POST', `/npp/orders/${o.id}/delivery`, TN, { colorLines: [
  { colorCode: 'CAFE_METALIC', basis: 'BUNDLE', actualKg: 200, unitPricePerKg: 144000 }, { colorCode: 'CAFE_METALIC', basis: 'BARE', actualKg: 70, unitPricePerKg: 150000 },
  { colorCode: 'XAM_NGOC_TRAI', basis: 'BUNDLE', actualKg: 270, unitPricePerKg: 152000 }, { colorCode: 'VAN_GO_CAM_LAI', basis: 'BARE', actualKg: 268, unitPricePerKg: 178000 }] }, { 'idempotency-key': 'smoke-b-' + Date.now() });
console.log('đủ màu ->', d2.s, d2.d.status, 'tiền', d2.d.totalAmount, 'kg', d2.d.actualTotalKg, 'bq', d2.d.finalUnitPricePerKg);
console.log((d2.d.colorWeighings ?? []).map((w) => `${w.colorCode} ${w.basis} ${w.actualKg}kg=${w.amount}`).join(' | '));
console.log('note:', d2.d.pricingNote);
const exp = 200 * 144000 + 70 * 150000 + 270 * 152000 + 268 * 178000; console.log('kỳ vọng', exp, exp === d2.d.totalAmount ? 'KHỚP' : 'LỆCH');
