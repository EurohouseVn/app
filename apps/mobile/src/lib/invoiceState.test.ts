import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dmy,
  draftTotal,
  filterInvoices,
  groupInvoicesByMonth,
  ledgerBanner,
  statusMeta,
  statusCounts,
} from './invoiceState.ts';

type Inv = Parameters<typeof statusMeta>[0] & { id: string; issueDate: string; buyerName: string; buyerTaxCode: string; projectCode: string; total: number };

function inv(id: string, issueDate: string, total: number, status: Inv['status'], extra: Partial<Inv> = {}): Inv {
  return { id, issueDate, total, status, provider: 'SANDBOX', number: status === 'DRAFT' ? null : id, buyerName: 'Nguyễn Thị Lan', buyerTaxCode: '', projectCode: '', ...extra };
}

const base = {
  threshold: 1_000_000_000,
  remaining: 153_500_000,
  currentQuarter: 4,
  crossedOn: null as string | null,
  registrationDeadline: null as string | null,
  registrationDeadlineIfCrossedNow: '2027-01-30' as string | null,
  daysToDeadline: null as number | null,
  crossedQuarter: null as number | null,
};

test('dmy', () => {
  assert.equal(dmy('2027-01-30'), '30/01/2027');
});

test('cảnh báo: chưa tới 80% thì không hiện', () => {
  assert.equal(ledgerBanner({ ...base, alert: 'NONE' }), null);
});

test('cảnh báo sắp vượt ngưỡng nêu số còn lại và hạn nếu vượt trong quý hiện tại', () => {
  const b = ledgerBanner({ ...base, alert: 'NEAR' })!;
  assert.equal(b.tone, 'warning');
  assert.equal(b.title, 'Sắp vượt ngưỡng 1 tỷ');
  assert.equal(b.text, 'Còn 153,5 tr. Nếu vượt trong quý 4, phải đăng ký hoá đơn điện tử trước 30/01/2027 và khai thuế theo quý.');
});

test('cảnh báo đã vượt và quá hạn', () => {
  const crossed = ledgerBanner({ ...base, alert: 'CROSSED', crossedOn: '2026-05-10', crossedQuarter: 2, registrationDeadline: '2026-07-30', daysToDeadline: 20, remaining: 0 })!;
  assert.equal(crossed.tone, 'error');
  assert.equal(crossed.title, 'Đã vượt ngưỡng 1 tỷ từ 10/05/2026');
  assert.equal(crossed.text, 'Đăng ký hoá đơn điện tử trước 30/07/2026 (còn 20 ngày) và khai thuế theo quý. Đăng ký xong thì ghi ngày vào hồ sơ thuế.');
  const today = ledgerBanner({ ...base, alert: 'CROSSED', crossedOn: '2026-05-10', crossedQuarter: 2, registrationDeadline: '2026-07-30', daysToDeadline: 0, remaining: 0 })!;
  assert.match(today.text, /hôm nay là hạn cuối/);
  const overdue = ledgerBanner({ ...base, alert: 'OVERDUE', crossedOn: '2026-05-10', crossedQuarter: 2, registrationDeadline: '2026-07-30', daysToDeadline: -6, remaining: 0 })!;
  assert.equal(overdue.title, 'Quá hạn đăng ký hoá đơn điện tử');
  assert.equal(overdue.text, 'Hạn là 30/07/2026, đã quá 6 ngày. Đăng ký ngay và hỏi kế toán về khai bổ sung.');
});

test('đã đăng ký hoá đơn điện tử', () => {
  const b = ledgerBanner({ ...base, alert: 'REGISTERED', crossedQuarter: 2, crossedOn: '2026-05-10', remaining: 0 })!;
  assert.equal(b.tone, 'success');
  assert.equal(b.text, 'Doanh thu đã vượt 1 tỷ: khai thuế GTGT, TNCN theo quý.');
});

test('nhãn trạng thái: phát hành bằng Bản thử ghi rõ', () => {
  assert.deepEqual(statusMeta({ status: 'ISSUED', provider: 'SANDBOX', number: '1' }), { label: 'Bản thử', tone: 'test' });
  assert.deepEqual(statusMeta({ status: 'ISSUED', provider: null, number: '1' }), { label: 'Đã phát hành', tone: 'ok' });
  assert.deepEqual(statusMeta({ status: 'DRAFT', provider: null, number: null }), { label: 'Nháp', tone: 'draft' });
  assert.deepEqual(statusMeta({ status: 'CANCELLED', provider: null, number: '1' }), { label: 'Đã huỷ', tone: 'cancel' });
  assert.deepEqual(statusMeta({ status: 'REPLACED', provider: null, number: '1' }), { label: 'Đã bị thay thế', tone: 'cancel' });
});

test('nhóm theo tháng, tổng tháng chỉ tính hoá đơn đã phát hành, tháng mới trước', () => {
  const groups = groupInvoicesByMonth([
    inv('a', '2026-11-18', 68_420_000, 'ISSUED'),
    inv('b', '2026-11-12', 92_000_000, 'DRAFT'),
    inv('c', '2026-11-05', 47_000_000, 'CANCELLED'),
    inv('d', '2026-10-29', 38_600_000, 'ISSUED', { provider: null }),
  ]);
  assert.deepEqual(groups.map((g) => [g.label, g.total, g.items.length]), [['Tháng 11/2026', 68_420_000, 3], ['Tháng 10/2026', 38_600_000, 1]]);
});

test('lọc theo trạng thái và tìm không dấu theo khách, số, MST, công trình', () => {
  const list = [
    inv('00000148', '2026-11-18', 1, 'ISSUED'),
    inv('x', '2026-11-12', 1, 'DRAFT', { buyerName: 'Showroom Hoàng Gia', projectCode: 'CT-261102' }),
    inv('00000147', '2026-11-12', 1, 'ISSUED', { buyerName: 'Cty TNHH Minh Phúc', buyerTaxCode: '0312345678' }),
  ];
  assert.equal(filterInvoices(list, 'DRAFT', '').length, 1);
  assert.equal(filterInvoices(list, 'ALL', 'hoang gia').length, 1);
  assert.equal(filterInvoices(list, 'ALL', '148').length, 1);
  assert.equal(filterInvoices(list, 'ALL', '031234').length, 1);
  assert.equal(filterInvoices(list, 'ALL', 'ct-2611').length, 1);
  assert.equal(filterInvoices(list, 'ISSUED', 'lan').length, 1);
  assert.deepEqual(statusCounts(list), { ALL: 3, DRAFT: 1, ISSUED: 2, CANCELLED: 0 });
});

test('tổng nháp theo dòng', () => {
  assert.equal(draftTotal([{ quantity: 12.4, unitPrice: 2_850_000 }, { quantity: 1, unitPrice: 5_000_000 }]), 40_340_000);
  assert.equal(draftTotal([{ quantity: Number.NaN, unitPrice: 5 }]), 0);
});

test('đọc ngày gõ tay dd/mm/yyyy', async () => {
  const { parseDmy } = await import('./invoiceState.ts');
  assert.equal(parseDmy('18/11/2026'), '2026-11-18');
  assert.equal(parseDmy(' 1/2/2026 '), '2026-02-01');
  assert.equal(parseDmy('31/02/2026'), null);
  assert.equal(parseDmy('2026-11-18'), null);
  assert.equal(parseDmy(''), null);
});
