const R = 'http://127.0.0.1:3061/api';
const login = async () => (await (await fetch(R + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: 'npp@eurohouse.vn', password: 'Eurohouse@2026' }) })).json()).user.token;
const t = await login();
for (const [name, brand, category, unit, unitCost, quantity] of [['Bản lề 3D inox', 'Kinlong', 'Bản lề', 'bộ', 185000, 120], ['Khóa đa điểm cửa đi', 'Kinlong', 'Khóa', 'bộ', 640000, 45], ['Silicone trung tính', 'Apollo', 'Keo', 'chai', 52000, 300]]) {
  const r = await fetch(R + '/npp/accessories', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ name, brand, category, unit, unitCost, quantity }) }); console.log(r.status);
}
