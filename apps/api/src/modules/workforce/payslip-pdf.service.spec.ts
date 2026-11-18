import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { PayslipPdfService, type PayslipPdfData } from './payslip-pdf.service';
import { computePayslip } from './payslip';

function streams(buffer: Buffer): string[] {
  const raw = buffer.toString('latin1');
  const out: string[] = [];
  const pattern = /(?<!end)stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    const bytes = buffer.subarray(start, end);
    try { out.push(inflateSync(bytes).toString('latin1')); } catch { out.push(bytes.toString('latin1')); }
    pattern.lastIndex = end + 'endstream'.length;
  }
  return out;
}

const pageCount = (buffer: Buffer) => (buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

function data(adjustmentCount = 2): PayslipPdfData {
  const advances = Array.from({ length: adjustmentCount }, (_, i) => ({ kind: 'ADVANCE' as const, amount: 1_000_000, note: `Tạm ứng lần ${i + 1}`, date: `2026-11-${String(i + 1).padStart(2, '0')}` }));
  const slip = computePayslip({
    worker: {
      payType: 'MONTHLY', baseRate: 9_000_000, overtimeRate: 0, standardMonthlyDays: 26,
      sundayPayEnabled: true, sundayPayPercent: 200, holidayPayEnabled: true, holidayPayPercent: 300,
      insuranceEnabled: true, insuranceSalary: 5_000_000, paidLeaveDaysPerMonth: 1,
    },
    days: [{ date: '2026-11-01', status: 'PRESENT', regularHours: 0, overtimeHours: 2 }, { date: '2026-11-02', status: 'HALF', regularHours: 0, overtimeHours: 0 }],
    holidays: [],
    pieces: [{ label: 'Lắp cửa nhà chị Lan', projectName: 'Nhà chị Lan', amount: 1_200_000 }],
    adjustments: [{ kind: 'BONUS', amount: 300_000, note: 'Hoàn thành sớm' }, ...advances],
  });
  const line = (item: { kind: string; amount: number; note: string; date?: string }) => ({ label: item.kind, note: item.note, date: item.date, amount: item.amount });
  return {
    month: '2026-11',
    closed: true,
    organizationName: 'Xưởng Nhôm Kính An Phát',
    basePayFormula: '9.000.000 ÷ 26 × 1,5',
    worker: { name: 'Lê Quốc Bảo', roleName: 'Thợ chính', payType: 'MONTHLY', baseRate: 9_000_000, phone: '0912345678' },
    payslip: { ...slip, bonuses: slip.bonuses.map(line), advances: slip.advances.map(line), penalties: slip.penalties.map(line) },
    issuer: { name: 'Xưởng Nhôm Kính An Phát', address: '12 Lê Lợi, Thanh Hoá', phone: '0912 000 111' },
  };
}

test('payslip PDF renders a single A4 page with a clean Vietnamese text layer', async () => {
  const pdf = await new PayslipPdfService().render(data());
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.equal(pageCount(pdf), 1);
  const maps = streams(pdf).filter((text) => text.includes('beginbfrange'));
  assert.ok(maps.length > 0, 'fonts carry a ToUnicode map');
  for (const map of maps) assert.doesNotMatch(map, /<>/);
});

test('a long payslip flows onto another page instead of overlapping', async () => {
  const pdf = await new PayslipPdfService().render(data(40));
  assert.ok(pageCount(pdf) >= 2);
});
