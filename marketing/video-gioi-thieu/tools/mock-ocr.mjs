// Dịch vụ đọc ảnh GIẢ cho video: trả các dòng phụ kiện cố định cho phiếu minh hoạ. Cổng 3066. Chỉ dùng khi quay video.
import http from 'node:http';
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/v1/extract') {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      const kind = JSON.parse(body || '{}').kind;
      const groups = kind === 'ACCESSORY' ? [{ heading: 'Phụ kiện', lines: [
        { text: 'Khóa đa điểm cửa đi', brand: 'Kinlong', category: 'Khóa', quantity: 40, unit: 'bộ', unitCost: 640000 },
        { text: 'Tay nắm cửa đi 2 mặt', brand: 'Hafele', category: 'Tay nắm', quantity: 60, unit: 'bộ', unitCost: 420000 },
        { text: 'Ron EPDM đen', brand: 'Eurohouse', category: 'Ron', quantity: 80, unit: 'cuộn', unitCost: 380000 },
        { text: 'Bản lề cửa sổ hất 4 chấu', brand: 'Kinlong', category: 'Bản lề', quantity: 150, unit: 'bộ', unitCost: 96000 },
        { text: 'Vít inox 4.2x16', brand: 'Eurohouse', category: 'Vít', quantity: 40, unit: 'hộp', unitCost: 58000 },
      ] }] : [];
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ engine: 'mock-ocr (video)', groups }));
    });
  } else { res.writeHead(404); res.end(); }
});
server.listen(3066, '127.0.0.1', () => console.log('mock ocr 3066'));
