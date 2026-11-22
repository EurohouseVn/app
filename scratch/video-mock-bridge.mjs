// Cầu nối AI GIẢ chỉ để quay video (cổng 3055). Không gọi dịch vụ nào bên ngoài.
import http from 'node:http'; import fs from 'node:fs';
const img = fs.readFileSync('E:/LELOIGLOBAL_CODEX/APP EUROHOUSE/apps/mobile/assets/brand/hero-ecento-70.jpg').toString('base64');
http.createServer((req, res) => {
  let body=''; req.on('data', c => body += c); req.on('end', () => {
    const j = JSON.parse(body || '{}'); const p = String(j.prompt || '').toLowerCase();
    let text = 'Dạ, em đã nhận yêu cầu. Anh/chị cần em hỗ trợ thêm phần nào ạ?';
    if (j.expectImage) text = 'Đây là phối cảnh cửa đi nhôm Ecento 70 màu xám ghi cho mặt tiền biệt thự.';
    else if (p.includes('lời chào') || p.includes('báo giá')) text = 'Dạ, em gửi anh bản báo giá cửa nhôm Eurohouse Ecento 70 cho công trình của mình. Giá đã gồm kính hộp, phụ kiện đồng bộ và bảo hành 5 năm. Anh cần chỉnh hạng mục nào cứ nhắn em, em cập nhật ngay trong hôm nay ạ.';
    else if (p.includes('bảo dưỡng')) text = '1. Lau khung bằng khăn ẩm, tránh dung môi mạnh.\n2. Tra dầu bản lề, khoá 6 tháng một lần.\n3. Kiểm tra gioăng, thay khi chai cứng.';
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ threadId: j.threadId || 'demo-thread', text, images: j.expectImage ? [{ mime: 'image/jpeg', base64: img }] : [] }));
  });
}).listen(3055, '127.0.0.1');
