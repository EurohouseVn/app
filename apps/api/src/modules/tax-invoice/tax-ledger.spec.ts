import test from 'node:test';
import assert from 'node:assert/strict';
import { taxRuleForYear } from './tax-rules';
import { buildYearLedger, estimateTax, vnDateKey, type LedgerInvoice, type LedgerReceipt } from './tax-ledger';
import { computeInvoiceTotals, validateForIssue } from './invoice-rules';

const rule2026 = taxRuleForYear(2026);

function inv(date: string, total: number, status: LedgerInvoice['status'] = 'ISSUED'): LedgerInvoice {
  return { issueDate: new Date(`${date}T03:00:00Z`), total, status };
}
function rec(date: string, amount: number): LedgerReceipt {
  return { transDate: new Date(`${date}T03:00:00Z`), amount };
}

test('quy tắc 2026: ngưỡng 1 tỷ, tỷ lệ nhôm kính là cấu hình chưa xác nhận', () => {
  assert.equal(rule2026.exemptThreshold, 1_000_000_000);
  assert.equal(rule2026.lines.MANUFACTURING.vatPct, 3);
  assert.equal(rule2026.lines.MANUFACTURING.pitPct, 1.5);
  assert.equal(rule2026.confirmed, false);
  // Năm chưa có trong bảng dùng năm gần nhất trước đó.
  assert.equal(taxRuleForYear(2027).exemptThreshold, 1_000_000_000);
  assert.equal(taxRuleForYear(2027).year, 2026);
});

test('ngày theo giờ Việt Nam: 17:30 UTC ngày 31/3 là 01/4', () => {
  assert.equal(vnDateKey(new Date('2026-03-31T17:30:00Z')), '2026-04-01');
  assert.equal(vnDateKey(new Date('2026-03-31T16:59:00Z')), '2026-03-31');
});

test('sổ năm: chỉ tính hoá đơn đã phát hành, hai cột theo tháng và quý', () => {
  const ledger = buildYearLedger({
    year: 2026,
    rule: rule2026,
    today: new Date('2026-11-18T03:00:00Z'),
    invoices: [
      inv('2026-01-10', 100_000_000),
      inv('2026-02-03', 20_000_000, 'DRAFT'),
      inv('2026-02-05', 50_000_000, 'CANCELLED'),
      inv('2026-02-06', 40_000_000, 'REPLACED'),
      inv('2026-02-07', 45_000_000),
      inv('2026-11-02', 30_000_000),
      inv('2025-12-31', 999_000_000),
    ],
    receipts: [rec('2026-01-12', 60_000_000), rec('2026-04-01', 25_000_000), rec('2027-01-01', 1)],
  });
  assert.equal(ledger.months.length, 12);
  assert.equal(ledger.months[0].invoiced, 100_000_000);
  assert.equal(ledger.months[1].invoiced, 45_000_000);
  assert.equal(ledger.months[1].invoiceCount, 1);
  assert.equal(ledger.months[0].collected, 60_000_000);
  assert.deepEqual(ledger.quarters.map((q) => q.invoiced), [145_000_000, 0, 0, 30_000_000]);
  assert.deepEqual(ledger.quarters.map((q) => q.collected), [60_000_000, 25_000_000, 0, 0]);
  assert.equal(ledger.totalInvoiced, 175_000_000);
  assert.equal(ledger.totalCollected, 85_000_000);
  assert.equal(ledger.invoiceCount, 3);
  assert.equal(ledger.receiptCount, 2);
  assert.equal(ledger.remaining, 825_000_000);
  assert.equal(ledger.alert, 'NONE');
  assert.equal(ledger.crossedQuarter, null);
  assert.equal(ledger.annualNoticeDeadline, '2027-01-31');
  assert.equal(ledger.currentQuarter, 4);
});

test('đạt 80% ngưỡng: cảnh báo NEAR, nêu hạn nếu vượt trong quý hiện tại', () => {
  const ledger = buildYearLedger({
    year: 2026,
    rule: rule2026,
    today: new Date('2026-11-18T03:00:00Z'),
    invoices: [inv('2026-03-01', 500_000_000), inv('2026-10-15', 346_500_000)],
    receipts: [],
  });
  assert.equal(ledger.alert, 'NEAR');
  assert.equal(Math.round(ledger.thresholdPct * 10) / 10, 84.7);
  assert.equal(ledger.registrationDeadlineIfCrossedNow, '2027-01-30');
});

test('vượt ngưỡng trong quý 2: hạn đăng ký là 30 ngày sau 30/6', () => {
  const base = {
    year: 2026,
    rule: rule2026,
    invoices: [inv('2026-03-20', 900_000_000), inv('2026-05-10', 150_000_000), inv('2026-08-01', 10_000_000)],
    receipts: [],
  };
  const crossed = buildYearLedger({ ...base, today: new Date('2026-07-10T03:00:00Z') });
  assert.equal(crossed.crossedQuarter, 2);
  assert.equal(crossed.crossedOn, '2026-05-10');
  assert.equal(crossed.registrationDeadline, '2026-07-30');
  assert.equal(crossed.daysToDeadline, 20);
  assert.equal(crossed.alert, 'CROSSED');

  const overdue = buildYearLedger({ ...base, today: new Date('2026-08-05T03:00:00Z') });
  assert.equal(overdue.alert, 'OVERDUE');
  assert.equal(overdue.daysToDeadline, -6);

  const registered = buildYearLedger({ ...base, today: new Date('2026-08-05T03:00:00Z'), einvoiceRegisteredAt: new Date('2026-07-20T03:00:00Z') });
  assert.equal(registered.alert, 'REGISTERED');
});

test('đúng bằng 1 tỷ chưa tính là vượt ngưỡng', () => {
  const ledger = buildYearLedger({ year: 2026, rule: rule2026, today: new Date('2026-12-01T03:00:00Z'), invoices: [inv('2026-06-01', 1_000_000_000)], receipts: [] });
  assert.equal(ledger.crossedQuarter, null);
  assert.equal(ledger.alert, 'NEAR');
});

test('dự phóng cả năm theo nhịp hiện tại, chỉ cho năm đang chạy', () => {
  const running = buildYearLedger({ year: 2026, rule: rule2026, today: new Date('2026-07-02T03:00:00Z'), invoices: [inv('2026-03-01', 500_000_000)], receipts: [] });
  // 2/7 là ngày thứ 183 của năm 365 ngày.
  assert.equal(running.projectedYearRevenue, Math.round(500_000_000 / 183 * 365));
  const past = buildYearLedger({ year: 2025, rule: rule2026, today: new Date('2026-07-02T03:00:00Z'), invoices: [], receipts: [] });
  assert.equal(past.projectedYearRevenue, null);
});

test('thuế: dưới hoặc bằng ngưỡng thì miễn', () => {
  const tax = estimateTax({ revenue: 846_500_000, rule: rule2026, businessLine: 'MANUFACTURING', pitMethod: 'REVENUE_RATE' });
  assert.equal(tax.exempt, true);
  assert.equal(tax.vat, 0);
  assert.equal(tax.pit, 0);
  assert.equal(tax.total, 0);
});

test('thuế: 1,2 tỷ theo tỷ lệ doanh thu', () => {
  const tax = estimateTax({ revenue: 1_200_000_000, rule: rule2026, businessLine: 'MANUFACTURING', pitMethod: 'REVENUE_RATE' });
  assert.equal(tax.exempt, false);
  assert.equal(tax.vat, 36_000_000);
  assert.equal(tax.pit, 3_000_000);
  assert.equal(tax.total, 39_000_000);
  assert.equal(tax.pitMethod, 'REVENUE_RATE');
  assert.match(tax.vatFormula, /3%/);
});

test('thuế: tỷ lệ riêng của xưởng ghi đè bảng năm', () => {
  const tax = estimateTax({ revenue: 2_000_000_000, rule: rule2026, businessLine: 'MANUFACTURING', pitMethod: 'REVENUE_RATE', vatPct: 5, pitPct: 2 });
  assert.equal(tax.vat, 100_000_000);
  assert.equal(tax.pit, 20_000_000);
});

test('thuế: theo thu nhập cần chi phí, 15% tới 3 tỷ, trên 3 tỷ bắt buộc theo thu nhập 17%', () => {
  const noCost = estimateTax({ revenue: 1_500_000_000, rule: rule2026, businessLine: 'MANUFACTURING', pitMethod: 'INCOME' });
  assert.equal(noCost.pit, null);
  assert.equal(noCost.total, 45_000_000);
  const income = estimateTax({ revenue: 1_500_000_000, cost: 1_100_000_000, rule: rule2026, businessLine: 'MANUFACTURING', pitMethod: 'INCOME' });
  assert.equal(income.pit, 60_000_000);
  const big = estimateTax({ revenue: 4_000_000_000, cost: 3_000_000_000, rule: rule2026, businessLine: 'MANUFACTURING', pitMethod: 'REVENUE_RATE' });
  assert.equal(big.pitMethod, 'INCOME');
  assert.equal(big.pit, 170_000_000);
  const loss = estimateTax({ revenue: 1_500_000_000, cost: 2_000_000_000, rule: rule2026, businessLine: 'MANUFACTURING', pitMethod: 'INCOME' });
  assert.equal(loss.pit, 0);
});

test('hoá đơn: tổng theo dòng, hộ kinh doanh không tách GTGT', () => {
  const lines = [{ quantity: 12.4, unitPrice: 2_850_000 }, { quantity: 1, unitPrice: 5_000_000 }];
  assert.deepEqual(computeInvoiceTotals(lines, 0), { amounts: [35_340_000, 5_000_000], subtotal: 40_340_000, vatAmount: 0, total: 40_340_000 });
  assert.deepEqual(computeInvoiceTotals(lines, 8), { amounts: [35_340_000, 5_000_000], subtotal: 40_340_000, vatAmount: 3_227_200, total: 43_567_200 });
});

test('hoá đơn: kiểm tra trước khi phát hành', () => {
  const profile = { taxCode: '8312456789', legalName: 'Hộ KD An Phát', invoiceSeries: '1C26TAP' };
  const ok = { buyerName: 'Nguyễn Thị Lan', buyerTaxCode: '', lines: [{ name: 'Cửa', quantity: 1, unitPrice: 1_000_000 }] };
  assert.deepEqual(validateForIssue(ok, profile), []);
  assert.deepEqual(validateForIssue(ok, { taxCode: '', legalName: '', invoiceSeries: '' }), [
    'Chưa có mã số thuế của xưởng trong hồ sơ thuế.',
    'Chưa có tên đăng ký kinh doanh trong hồ sơ thuế.',
    'Chưa có ký hiệu hoá đơn trong hồ sơ thuế.',
  ]);
  assert.deepEqual(validateForIssue({ buyerName: ' ', buyerTaxCode: '12ab', lines: [] }, profile), [
    'Thiếu tên người mua.',
    'Mã số thuế người mua phải có 10 hoặc 13 chữ số.',
    'Hoá đơn cần ít nhất một dòng hàng.',
  ]);
  assert.deepEqual(validateForIssue({ ...ok, lines: [{ name: '', quantity: 0, unitPrice: 5 }] }, profile), [
    'Dòng 1: thiếu tên hàng hoá, dịch vụ.',
    'Dòng 1: số lượng phải lớn hơn 0.',
  ]);
  assert.deepEqual(validateForIssue({ ...ok, buyerTaxCode: '0312345678-001' }, profile), []);
});
