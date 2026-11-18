import test from 'node:test';
import assert from 'node:assert/strict';
import { computePayslip, type PayslipDay, type PayslipWorker } from './payslip';

const monthly: PayslipWorker = {
  payType: 'MONTHLY',
  baseRate: 9_000_000,
  overtimeRate: 0,
  standardMonthlyDays: 26,
  sundayPayEnabled: true,
  sundayPayPercent: 200,
  holidayPayEnabled: true,
  holidayPayPercent: 300,
  insuranceEnabled: true,
  insuranceSalary: 5_000_000,
  paidLeaveDaysPerMonth: 1,
};

const daily: PayslipWorker = {
  ...monthly,
  payType: 'DAILY',
  baseRate: 400_000,
  sundayPayEnabled: false,
  holidayPayEnabled: false,
  insuranceEnabled: false,
  insuranceSalary: 0,
};

function day(date: string, status: PayslipDay['status'], extra: Partial<PayslipDay> = {}): PayslipDay {
  return { date, status, regularHours: 0, overtimeHours: 0, ...extra };
}

/** Tháng 11/2026: 22 ngày đủ công (có 1 Chủ nhật 01/11), 2 nửa công, 1 ngày phép. */
function novemberDays(): PayslipDay[] {
  const full = ['01', '02', '03', '04', '05', '06', '07', '09', '10', '11', '12', '13', '14', '16', '17', '18', '19', '20', '21', '23', '24', '25'];
  const days = full.map((d) => day(`2026-11-${d}`, 'PRESENT'));
  days[2].overtimeHours = 12.5;
  days.push(day('2026-11-26', 'HALF'), day('2026-11-27', 'HALF'), day('2026-11-28', 'LEAVE'));
  return days;
}

test('monthly worker payslip matches the approved wireframe example', () => {
  const slip = computePayslip({
    worker: monthly,
    days: novemberDays(),
    holidays: [],
    pieces: [{ label: 'Lắp cửa nhà chị Lan', projectName: 'CT-261020', amount: 1_200_000 }],
    adjustments: [
      { kind: 'BONUS', amount: 300_000, note: 'Hoàn thành sớm showroom Hoàng Gia' },
      { kind: 'ADVANCE', amount: 1_000_000, note: '05/11' },
      { kind: 'ADVANCE', amount: 1_000_000, note: '15/11' },
    ],
  });
  assert.equal(slip.fullDays, 22);
  assert.equal(slip.halfDays, 2);
  assert.equal(slip.paidLeaveDays, 1);
  assert.equal(slip.workUnits, 24);
  assert.equal(slip.basePay, 8_307_692);
  assert.equal(slip.overtimeHours, 12.5);
  assert.equal(slip.overtimeHourlyRate, 64_904);
  assert.equal(slip.overtimePay, 811_298);
  assert.equal(slip.sundayDays, 1);
  assert.equal(slip.sundayPay, 346_154);
  assert.equal(slip.pieceTotal, 1_200_000);
  assert.equal(slip.bonusTotal, 300_000);
  assert.equal(slip.gross, 10_965_144);
  assert.equal(slip.insuranceEmployee, 525_000);
  assert.equal(slip.insuranceEmployer, 1_075_000);
  assert.equal(slip.advanceTotal, 2_000_000);
  assert.equal(slip.deductions, 2_525_000);
  assert.equal(slip.net, 8_440_144);
});

test('a half day counts half a work unit for daily pay', () => {
  const slip = computePayslip({
    worker: daily,
    days: [day('2026-11-02', 'PRESENT'), day('2026-11-03', 'HALF'), day('2026-11-04', 'ABSENT'), day('2026-11-05', 'UNPAID_LEAVE')],
    holidays: [],
    pieces: [],
    adjustments: [],
  });
  assert.equal(slip.workUnits, 1.5);
  assert.equal(slip.basePay, 600_000);
  assert.equal(slip.absentDays, 1);
  assert.equal(slip.unpaidLeaveDays, 1);
  assert.equal(slip.net, 600_000);
});

test('leave beyond the monthly paid quota is unpaid', () => {
  const slip = computePayslip({
    worker: daily,
    days: [day('2026-11-02', 'LEAVE'), day('2026-11-03', 'LEAVE'), day('2026-11-04', 'LEAVE')],
    holidays: [],
    pieces: [],
    adjustments: [],
  });
  assert.equal(slip.paidLeaveDays, 1);
  assert.equal(slip.unpaidLeaveDays, 2);
  assert.equal(slip.basePay, 400_000);
});

test('monthly base pay never exceeds the monthly salary', () => {
  const days = Array.from({ length: 30 }, (_, i) => day(`2026-11-${String(i + 1).padStart(2, '0')}`, 'PRESENT'));
  const slip = computePayslip({ worker: { ...monthly, sundayPayEnabled: false }, days, holidays: [], pieces: [], adjustments: [] });
  assert.equal(slip.basePay, 9_000_000);
});

test('hourly workers marked without clock times are paid 8 hours a full day and 4 a half day', () => {
  const hourly: PayslipWorker = { ...daily, payType: 'HOURLY', baseRate: 50_000 };
  const slip = computePayslip({
    worker: hourly,
    days: [day('2026-11-02', 'PRESENT'), day('2026-11-03', 'HALF'), day('2026-11-04', 'PRESENT', { regularHours: 6 })],
    holidays: [],
    pieces: [],
    adjustments: [],
  });
  assert.equal(slip.regularHours, 18);
  assert.equal(slip.basePay, 900_000);
  assert.equal(slip.overtimeHourlyRate, 75_000);
});

test('a holiday on a Sunday is paid at the holiday rate only', () => {
  const worker: PayslipWorker = { ...daily, sundayPayEnabled: true, holidayPayEnabled: true };
  const slip = computePayslip({
    worker,
    days: [day('2026-11-01', 'PRESENT'), day('2026-11-08', 'HALF')],
    holidays: ['2026-11-01'],
    pieces: [],
    adjustments: [],
  });
  assert.equal(slip.holidayDays, 1);
  assert.equal(slip.holidayPay, 800_000);
  assert.equal(slip.sundayDays, 0.5);
  assert.equal(slip.sundayPay, 200_000);
});

test('no insurance is deducted when it is switched off; penalties are deducted', () => {
  const slip = computePayslip({
    worker: { ...daily, insuranceSalary: 5_000_000 },
    days: [day('2026-11-02', 'PRESENT')],
    holidays: [],
    pieces: [{ label: 'Gia công vách kính', amount: 250_000 }],
    adjustments: [{ kind: 'PENALTY', amount: 50_000, note: 'Đi muộn' }],
  });
  assert.equal(slip.insuranceEmployee, 0);
  assert.equal(slip.insuranceEmployer, 0);
  assert.equal(slip.penaltyTotal, 50_000);
  assert.equal(slip.gross, 650_000);
  assert.equal(slip.net, 600_000);
});
