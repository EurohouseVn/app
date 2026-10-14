import assert from 'node:assert/strict';
import test from 'node:test';
import { moneyInWords } from './pdf-document.util';
import { QuotationPdfService } from '../modules/quotations/quotation-pdf.service';
import { ProjectFinancialPdfService } from '../modules/workshop-operations/project-financial-pdf.service';

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
      id: 'i1', name: 'D1', doorType: 'Cửa đi 2 cánh', system: 'Hệ 55 Euroqueen', widthMm: 2000,
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
