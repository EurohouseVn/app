import test from 'node:test';
import assert from 'node:assert/strict';
import * as exceljs from 'exceljs';
import type { WorkshopSalesInvoice, WorkshopTaxProfile } from '@eurohouse/types';
import { InvoiceDocumentsService, type TaxReportData } from './invoice-documents.service';

const pageCount = (buffer: Buffer) => (buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

const profile: WorkshopTaxProfile = {
  entityType: 'HKD', taxCode: '8312456789', legalName: 'Hộ KD Nhôm Kính An Phát', legalAddress: '12 Nguyễn Thị Thập, Q7', locationCode: '',
  businessLine: 'MANUFACTURING', vatRatePct: null, pitRatePct: null, pitMethod: 'REVENUE_RATE', invoiceSeries: '1C26TAP', provider: 'SANDBOX',
  einvoiceRegisteredAt: null, updatedAt: null, isComplete: true,
  defaults: { year: 2026, exemptThreshold: 1_000_000_000, vatPct: 3, pitPct: 1.5, confirmed: false, source: '' },
};

function invoice(lineCount: number): WorkshopSalesInvoice {
  const lines = Array.from({ length: lineCount }, (_, i) => ({ name: `Cửa đi mở quay hệ 55 · D${i + 1} · 1200×2200 mm`, unit: 'bộ', quantity: 1, unitPrice: 5_000_000, amount: 5_000_000 }));
  return {
    id: 'inv-1', status: 'ISSUED', source: 'PROVIDER', provider: 'SANDBOX', series: '1C26TAP', number: '00000148', issueDate: '2026-11-18',
    buyerName: 'Nguyễn Thị Lan', buyerTaxCode: '', projectId: 'p1', projectCode: 'CT-261020', total: lineCount * 5_000_000, lineCount,
    cancelReason: '', replacesNumber: null, replacedByNumber: null, customerId: null, buyerAddress: 'Q7', buyerEmail: '', buyerPhone: '',
    subtotal: lineCount * 5_000_000, vatRatePct: 0, vatAmount: 0, note: '', lookupCode: 'TEST-7K2Q9', providerRef: 'sandbox-1',
    issuedAt: null, cancelledAt: null, replacesId: null, replacedById: null, lines, events: [], projectCollected: null,
  };
}

test('PDF hoá đơn: hoá đơn ngắn nằm trên một trang A4', async () => {
  const pdf = await new InvoiceDocumentsService().renderInvoicePdf({ invoice: invoice(4), profile, organization: { name: 'Xưởng An Phát' } });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(pageCount(pdf), 1);
});

test('PDF hoá đơn: nhiều dòng thì sang trang mới', async () => {
  const pdf = await new InvoiceDocumentsService().renderInvoicePdf({ invoice: invoice(40), profile, organization: null });
  assert.ok(pageCount(pdf) >= 2);
});

function reportData(): TaxReportData {
  const row = (date: string, number: string, total: number, status = 'ISSUED') => ({
    issueDate: new Date(`${date}T05:00:00Z`), series: '1C26TAP', number, status, source: 'PROVIDER', provider: 'SANDBOX',
    buyerName: 'Khách', buyerTaxCode: '', projectCode: '', subtotal: total, vatAmount: 0, total, cancelReason: status === 'CANCELLED' ? 'Sai giá' : '',
    replaces: null, lines: [{ name: 'Cửa' }],
  });
  return {
    year: 2026, profile, organizationName: 'Xưởng',
    invoices: [row('2026-02-01', '00000001', 100), row('2026-03-01', '00000002', 50, 'CANCELLED'), row('2026-05-01', '00000003', 30)],
    receipts: [{ transDate: new Date('2026-02-02T05:00:00Z'), code: 'PT-1', amount: 80, method: 'CASH', partnerName: 'Khách', note: '', project: { code: 'CT-1', name: 'Nhà A' } }],
  };
}

test('Sổ S1a: chỉ ghi hoá đơn đã phát hành, có cộng quý và cộng năm', async () => {
  const wb = new exceljs.Workbook();
  await wb.xlsx.load(await new InvoiceDocumentsService().renderS1a(reportData()) as never);
  const values = wb.getWorksheet('S1a-HKD')!.getSheetValues().map((r) => (Array.isArray(r) ? r.slice(1) : []));
  const flat = values.map((r) => r.join('|'));
  assert.ok(flat.some((r) => r.includes('1C26TAP-00000001') && r.endsWith('|100')));
  assert.ok(!flat.some((r) => r.includes('00000002')));
  assert.ok(flat.some((r) => r === '|||Cộng quý 1|100'));
  assert.ok(flat.some((r) => r === '|||Cộng quý 2|30'));
  assert.ok(flat.some((r) => r === '|||TỔNG CỘNG NĂM 2026|130'));
  assert.ok(wb.getWorksheet('Tiền thu (đối chiếu)'));
});

test('Bảng kê: có cả hoá đơn huỷ, tổng chỉ tính hoá đơn đã phát hành, lọc theo quý', async () => {
  const service = new InvoiceDocumentsService();
  const wb = new exceljs.Workbook();
  await wb.xlsx.load(await service.renderInvoiceList(reportData()) as never);
  const rows = wb.getWorksheet('Bảng kê')!.getSheetValues().map((r) => (Array.isArray(r) ? r.slice(1).join('|') : ''));
  assert.ok(rows.some((r) => r.includes('00000002') && r.includes('Đã huỷ') && r.includes('Huỷ: Sai giá')));
  assert.ok(rows.some((r) => r.includes('Tổng hoá đơn đã phát hành') && r.endsWith('|130')));

  const q2 = new exceljs.Workbook();
  await q2.xlsx.load(await service.renderInvoiceList(reportData(), 2) as never);
  const q2rows = q2.getWorksheet('Bảng kê')!.getSheetValues().map((r) => (Array.isArray(r) ? r.slice(1).join('|') : ''));
  assert.ok(!q2rows.some((r) => r.includes('00000001')));
  assert.ok(q2rows.some((r) => r.includes('00000003')));
});
