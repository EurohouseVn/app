// Dữ liệu GIẢ cho video giới thiệu. Chỉ chạy với API cục bộ cổng 3011 + CSDL tạm.
const API = 'http://127.0.0.1:3011/api';
let token = '';
async function call(method, path, body) {
  const res = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) { console.log('FAIL', method, path, res.status, String(text).slice(0, 200)); return null; }
  return json;
}
const login = await call('POST', '/auth/login', { identifier: 'tho@eurohouse.vn', password: 'Eurohouse@2026' });
token = login.user.token;
const d = (n) => { const x = new Date('2026-11-22T00:00:00+07:00'); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };

// --- Thợ
const workerDefs = [
  ['Nguyễn Văn Hùng', 'Thợ cắt nhôm', 'DAILY', 420000], ['Trần Minh Tuấn', 'Thợ lắp ráp', 'DAILY', 400000],
  ['Lê Quốc Bảo', 'Thợ lắp đặt', 'DAILY', 450000], ['Phạm Thị Lan', 'Kế toán xưởng', 'MONTHLY', 9000000],
  ['Võ Hoàng Nam', 'Thợ kính', 'HOURLY', 55000],
];
const workers = [];
for (const [name, roleName, payType, baseRate] of workerDefs) {
  const w = await call('POST', '/workforce/workers', { name, roleName, payType, baseRate, overtimeRate: payType === 'DAILY' ? Math.round(baseRate / 8 * 1.5) : undefined, insuranceEnabled: payType === 'MONTHLY', insuranceSalary: payType === 'MONTHLY' ? 6000000 : undefined, phone: '09' + Math.floor(10000000 + Math.random() * 89999999) });
  if (w) workers.push(w);
}
// --- Chấm công các ngày làm việc từ 1/11 đến 21/11 (bỏ Chủ nhật)
for (let n = 1; n <= 21; n++) {
  const date = d(n); const dow = new Date(date + 'T12:00:00+07:00').getDay();
  if (dow === 0) continue;
  for (const [i, w] of workers.entries()) {
    const status = (n + i) % 11 === 0 ? 'HALF' : (n + i) % 17 === 0 ? 'LEAVE' : 'PRESENT';
    await call('POST', '/workforce/attendance/day-status', { workerId: w.id, date, status });
  }
}
// --- Hôm nay: một số thợ đã vào ca
for (const w of workers.slice(0, 4)) await call('POST', '/workforce/attendance/check', { workerId: w.id, action: 'CHECK_IN' });
// --- Công trình
const projDefs = [
  ['Biệt thự anh Thành - Q.9', 'Anh Nguyễn Văn Thành', '0903 111 222', '45 Đường số 7, P. Long Thạnh Mỹ, TP. Thủ Đức', 186000000, 'IN_PROGRESS'],
  ['Nhà phố chị Mai - Bình Tân', 'Chị Lê Thị Mai', '0988 333 444', '12 Hồ Học Lãm, Q. Bình Tân', 94500000, 'IN_PROGRESS'],
  ['Căn hộ Sunrise - Quận 7', 'Anh Phạm Quốc Việt', '0912 555 666', 'Tầng 12, Sunrise City, Q.7', 62000000, 'OPEN'],
  ['Quán cà phê Gió - Tân Phú', 'Chị Trần Ngọc Hà', '0937 777 888', '88 Tân Hương, Q. Tân Phú', 128000000, 'DONE'],
];
const projects = [];
for (const [name, customerName, customerPhone, address, contractValue, status] of projDefs) {
  const p = await call('POST', '/projects', { name, customerName, customerPhone, address, contractValue, estimatedValue: contractValue });
  if (p) { await call('PATCH', `/projects/${p.id}`, { status, customerName, customerPhone, address, contractValue, costAluminum: Math.round(contractValue * 0.34), costGlass: Math.round(contractValue * 0.12), costAccessory: Math.round(contractValue * 0.1), costLabor: Math.round(contractValue * 0.12) }); projects.push(p); }
}
// --- Thu chi trên công trình
const cash = [
  [0, 'RECEIPT', 60000000, 'Tạm ứng đợt 1', 'Anh Thành', 40], [0, 'PAYMENT', 31200000, 'Nhôm', 'NPP Miền Nam', 33], [0, 'PAYMENT', 8400000, 'Kính', 'Kính Hải Long', 28],
  [0, 'RECEIPT', 50000000, 'Tạm ứng đợt 2', 'Anh Thành', 12], [0, 'PAYMENT', 6500000, 'Nhân công', 'Đội lắp đặt', 6],
  [1, 'RECEIPT', 40000000, 'Tạm ứng đợt 1', 'Chị Mai', 20], [1, 'PAYMENT', 17800000, 'Nhôm', 'NPP Miền Nam', 15], [1, 'PAYMENT', 3200000, 'Phụ kiện', 'Phụ kiện Kim Long', 9],
  [3, 'RECEIPT', 128000000, 'Quyết toán', 'Chị Hà', 18], [3, 'PAYMENT', 59000000, 'Vật tư', 'NPP Miền Nam', 50],
];
for (const [pi, type, amount, category, partnerName, ago] of cash) {
  if (projects[pi]) await call('POST', `/workshop/v2/projects/${projects[pi].id}/cash-transactions`, { type, amount, category, partnerName, method: ago % 2 ? 'BANK_TRANSFER' : 'CASH', transDate: d(ago), note: category });
}
// --- Việc khoán, thưởng/ứng
if (workers.length >= 3) {
  await call('POST', '/workforce/piece-jobs', { title: 'Lắp 6 bộ cửa đi - nhà anh Thành', projectId: projects[0]?.id, workDate: d(5), totalAmount: 4800000, workerIds: [workers[1].id, workers[2].id] });
  await call('POST', '/workforce/piece-jobs', { title: 'Cắt và đột nhôm Ecento 70', projectId: projects[1]?.id, workDate: d(3), totalAmount: 2400000, workerIds: [workers[0].id] });
  await call('POST', '/workforce/adjustments', { workerId: workers[0].id, kind: 'ADVANCE', amount: 1500000, note: 'Ứng lương', workDate: d(8) });
  await call('POST', '/workforce/adjustments', { workerId: workers[2].id, kind: 'BONUS', amount: 500000, note: 'Thưởng lắp đúng tiến độ', workDate: d(4) });
}
// --- Nhắc việc
const at = (h) => new Date(Date.now() + h * 3600000).toISOString();
for (const [title, h, priority, note] of [['Giao cửa cho nhà chị Mai', 20, 'HIGH', '12 Hồ Học Lãm'], ['Mua silicone và vít', 6, 'NORMAL', ''], ['Gọi anh Thành chốt màu', 30, 'NORMAL', 'Màu xám ghi']]) await call('POST', '/workforce/reminders', { title, dueAt: at(h), priority, note });
console.log('workers', workers.length, 'projects', projects.length);
console.log(JSON.stringify({ workers: workers.map((w) => w.id), projects: projects.map((p) => p.id) }));
