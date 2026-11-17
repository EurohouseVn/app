import assert from 'node:assert/strict';
import test from 'node:test';
import { inflateSync } from 'node:zlib';
import PDFDocument from 'pdfkit';
import { moneyInWords, registerPdfFonts } from './pdf-document.util';
import { QuotationPdfService } from '../modules/quotations/quotation-pdf.service';
import { ProjectFinancialPdfService } from '../modules/workshop-operations/project-financial-pdf.service';

// Every ToUnicode CMap in the file, inflated. An empty "<>" entry makes PDF
// readers mis-map all following glyphs (copy/search of Vietnamese breaks).
function toUnicodeMaps(buffer: Buffer): string[] {
  const raw = buffer.toString('latin1');
  const maps: string[] = [];
  const streamPattern = /(?<!end)stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = streamPattern.exec(raw))) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    const bytes = buffer.subarray(start, end);
    let text = bytes.toString('latin1');
    try { text = inflateSync(bytes).toString('latin1'); } catch { /* not compressed */ }
    if (text.includes('beginbfrange')) maps.push(text);
    streamPattern.lastIndex = end + 'endstream'.length;
  }
  return maps;
}

function renderDoc(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    draw(doc);
    doc.end();
  });
}

function pageCount(buffer: Buffer): number {
  return buffer.toString('latin1').match(/\/Type \/Page\b/g)?.length || 0;
}

test('Vietnamese money wording handles zero, variants, and sparse groups', () => {
  assert.equal(moneyInWords(0), 'Không đồng');
  assert.equal(moneyInWords(21), 'Hai mươi mốt đồng');
  assert.equal(moneyInWords(105), 'Một trăm lẻ năm đồng');
  assert.equal(moneyInWords(1_000_005), 'Một triệu không trăm lẻ năm đồng');
});

test('quotation PDF is a single-page valid document for a compact quotation', async () => {
  const pdf = await new QuotationPdfService().render({
    id: 'q1', code: 'BG-TEST-01', customerName: 'Nguyễn Văn An', customerPhone: '0901000000',
    customerAddress: 'TP. Hồ Chí Minh', createdAt: new Date().toISOString(), areaM2: 4,
    baseAmount: 10_000_000, accessoryCost: 0, laborCost: 0, installCost: 0, depreciation: 0,
    profitPct: 0, profitAmount: 0, vatPct: 0, vatAmount: 0, totalAmount: 10_000_000,
    items: [{
      id: 'i1', name: 'D1', doorType: 'Cửa đi 2 cánh', system: 'Hệ 55 Vát Cạnh', widthMm: 2000,
      heightMm: 2000, quantity: 1, pricePerM2: 2_500_000, areaM2: 4, totalPrice: 10_000_000,
    }],
  }, null, 'quotation');
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.equal(pageCount(pdf), 1);
  assert.ok(pdf.length > 10_000);
});

test('financial PDF is a single-page valid document for a compact project', async () => {
  const pdf = await new ProjectFinancialPdfService().render({
    code: 'CT-TEST-01', name: 'Nhà phố anh An', customerName: 'Nguyễn Văn An', customerPhone: '0901000000',
    address: 'TP. Hồ Chí Minh', status: 'IN_PROGRESS', contractValue: 100_000_000, estimatedValue: 100_000_000,
    incurredValue: 0, incurredType: 'INCREASE', settledValue: 100_000_000, extraRevenue: 0,
    costAluminum: 0, costAccessory: 0, costLockHinge: 0, costGlass: 0,
    costGasket: 0, costSilicone: 0, costScrew: 0, costLabor: 0,
    costConsumables: 0, costTransport: 0, costInstallation: 0, costPartnerPct: 0, costOther: 0,
    note: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), transactions: [],
  });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.equal(pageCount(pdf), 1);
  assert.ok(pdf.length > 10_000);
});

test('Vietnamese dot-below letters keep a valid text layer (no empty ToUnicode entries)', async () => {
  const pdf = await renderDoc((doc) => {
    registerPdfFonts(doc);
    doc.font('body').text('Địa chỉ công trình: Ký, ghi rõ họ tên. Hợp đồng, quyết toán, nghiệm thu.');
    doc.font('bold').text('ĐẠI DIỆN KHÁCH HÀNG · Tổng cộng thanh toán');
  });
  const maps = toUnicodeMaps(pdf);
  assert.ok(maps.length >= 2, 'both fonts embed a ToUnicode CMap');
  for (const map of maps) assert.doesNotMatch(map, /<>/);
  assert.match(maps.join('\n'), /<1ecb>/i, 'ị is mapped as a single precomposed glyph');
});

test('a real quotation PDF has no empty ToUnicode entries', async () => {
  const pdf = await new QuotationPdfService().render({
    id: 'q2', code: 'BG-TEST-02', customerName: 'Nguyễn Thị Định', customerPhone: '0901000000',
    customerAddress: 'Sầm Sơn, Thanh Hoá', createdAt: new Date().toISOString(), areaM2: 4,
    baseAmount: 10_000_000, accessoryCost: 0, laborCost: 0, installCost: 0, depreciation: 0,
    profitPct: 0, profitAmount: 0, vatPct: 0, vatAmount: 0, totalAmount: 10_000_000,
    items: [{
      id: 'i1', name: 'D1', doorType: 'Cửa đi mở quay', system: 'Hệ 55 Vát Cạnh', widthMm: 2000,
      heightMm: 2000, quantity: 1, pricePerM2: 2_500_000, areaM2: 4, totalPrice: 10_000_000,
    }],
  }, null, 'quotation');
  for (const map of toUnicodeMaps(pdf)) assert.doesNotMatch(map, /<>/);
});
