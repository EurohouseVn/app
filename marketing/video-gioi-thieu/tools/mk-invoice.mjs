// Tạo ảnh phiếu nhập phụ kiện GIẢ (minh hoạ) để quay cảnh nhập kho bằng ảnh chụp.
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const out = path.resolve(process.argv[2]); fs.mkdirSync(path.dirname(out), { recursive: true });
const rows = [['Khóa đa điểm cửa đi', 'Kinlong', 'bộ', 40, 640000], ['Tay nắm cửa đi 2 mặt', 'Hafele', 'bộ', 60, 420000], ['Ron EPDM đen', 'Eurohouse', 'cuộn', 80, 380000], ['Bản lề cửa sổ hất 4 chấu', 'Kinlong', 'bộ', 150, 96000], ['Vít inox 4.2x16', 'Eurohouse', 'hộp', 40, 58000]];
const f = (n) => n.toLocaleString('vi-VN');
const html = `<body style="margin:0;background:#8a8f98"><div style="width:760px;margin:30px auto;background:#fffdf6;padding:38px 44px;font-family:Arial;color:#222;box-shadow:0 10px 30px rgba(0,0,0,.35);transform:rotate(-1deg)">
<div style="display:flex;justify-content:space-between"><div><b style="font-size:22px">CÔNG TY TNHH PHỤ KIỆN KIM LONG</b><br><small>Số 18 Nguyễn Văn Linh, Q.7, TP.HCM</small></div><div style="text-align:right"><b>PHIẾU GIAO HÀNG</b><br><small>Số: PGH-26-1142<br>Ngày 26/11/2026</small></div></div>
<p style="margin:18px 0 8px">Khách hàng: <b>NPP Nhôm Miền Nam</b></p>
<table style="width:100%;border-collapse:collapse;font-size:15px"><tr style="background:#eee">${['STT', 'Tên hàng', 'Hãng', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'].map((h) => `<th style="border:1px solid #999;padding:7px">${h}</th>`).join('')}</tr>
${rows.map((r, i) => `<tr><td style="border:1px solid #999;padding:7px;text-align:center">${i + 1}</td><td style="border:1px solid #999;padding:7px">${r[0]}</td><td style="border:1px solid #999;padding:7px">${r[1]}</td><td style="border:1px solid #999;padding:7px;text-align:center">${r[2]}</td><td style="border:1px solid #999;padding:7px;text-align:right">${r[3]}</td><td style="border:1px solid #999;padding:7px;text-align:right">${f(r[4])}</td><td style="border:1px solid #999;padding:7px;text-align:right">${f(r[3] * r[4])}</td></tr>`).join('')}
</table><p style="text-align:right;margin-top:14px"><b>Tổng cộng: ${f(rows.reduce((s, r) => s + r[3] * r[4], 0))} đ</b></p><p style="font-size:12px;color:#666">Phiếu minh hoạ cho video, không phải chứng từ thật.</p></div></body>`;
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage({ viewport: { width: 860, height: 640 } });
await p.setContent(html); await p.screenshot({ path: out }); await b.close(); console.log('ok', out);
