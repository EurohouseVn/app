// Phiếu lương tháng của một thợ: hàm thuần, không chạm CSDL (unit-tested in payslip.spec.ts).

export type PayslipPayType = 'DAILY' | 'HOURLY' | 'MONTHLY';
export type PayslipDayStatus = 'PRESENT' | 'HALF' | 'LEAVE' | 'UNPAID_LEAVE' | 'ABSENT';
export type PayslipAdjustmentKind = 'ADVANCE' | 'BONUS' | 'PENALTY';

export const EMPLOYEE_INSURANCE_RATE = 0.105; // BHXH 8% + BHYT 1,5% + BHTN 1%
export const EMPLOYER_INSURANCE_RATE = 0.215; // BHXH 17,5% (gồm TNLĐ-BNN) + BHYT 3% + BHTN 1%
const FULL_DAY_HOURS = 8;

export interface PayslipWorker {
  payType: PayslipPayType;
  baseRate: number;
  overtimeRate: number;
  standardMonthlyDays: number;
  sundayPayEnabled: boolean;
  sundayPayPercent: number;
  holidayPayEnabled: boolean;
  holidayPayPercent: number;
  insuranceEnabled: boolean;
  insuranceSalary: number;
  paidLeaveDaysPerMonth: number;
}

export interface PayslipDay {
  /** YYYY-MM-DD */
  date: string;
  status: PayslipDayStatus;
  regularHours: number;
  overtimeHours: number;
}

export interface PayslipPiece {
  label: string;
  projectName?: string;
  amount: number;
}

export interface PayslipAdjustment {
  kind: PayslipAdjustmentKind;
  amount: number;
  note: string;
  date?: string;
}

export interface PayslipInput {
  worker: PayslipWorker;
  days: PayslipDay[];
  /** YYYY-MM-DD of days marked Lễ/Tết */
  holidays: string[];
  pieces: PayslipPiece[];
  adjustments: PayslipAdjustment[];
}

export interface Payslip {
  fullDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  /** Ngày công tính lương: đủ công + ½ × nửa công + phép có lương */
  workUnits: number;
  regularHours: number;
  overtimeHours: number;
  overtimeHourlyRate: number;
  basePay: number;
  overtimePay: number;
  sundayDays: number;
  sundayPay: number;
  holidayDays: number;
  holidayPay: number;
  pieces: PayslipPiece[];
  pieceTotal: number;
  bonuses: PayslipAdjustment[];
  bonusTotal: number;
  gross: number;
  insuranceSalary: number;
  insuranceEmployee: number;
  insuranceEmployer: number;
  advances: PayslipAdjustment[];
  advanceTotal: number;
  penalties: PayslipAdjustment[];
  penaltyTotal: number;
  deductions: number;
  net: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const money = (value: number) => Math.round(Number(value) || 0);
const isSunday = (date: string) => new Date(`${date}T00:00:00.000Z`).getUTCDay() === 0;

function workedUnit(status: PayslipDayStatus): number {
  if (status === 'PRESENT') return 1;
  if (status === 'HALF') return 0.5;
  return 0;
}

/** Giờ công thường của một ngày; chấm trạng thái mà không có giờ thì tính 8 giờ (nửa công 4 giờ). */
function regularHoursOf(day: PayslipDay): number {
  const unit = workedUnit(day.status);
  if (!unit) return 0;
  return day.regularHours > 0 ? day.regularHours : FULL_DAY_HOURS * unit;
}

export function computePayslip(input: PayslipInput): Payslip {
  const { worker } = input;
  const standardDays = Math.max(1, worker.standardMonthlyDays || 26);
  const holidaySet = new Set(input.holidays);
  const days = [...input.days].sort((a, b) => a.date.localeCompare(b.date));

  let fullDays = 0;
  let halfDays = 0;
  let leaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;
  for (const day of days) {
    if (day.status === 'PRESENT') fullDays += 1;
    else if (day.status === 'HALF') halfDays += 1;
    else if (day.status === 'LEAVE') leaveDays += 1;
    else if (day.status === 'UNPAID_LEAVE') unpaidLeaveDays += 1;
    else absentDays += 1;
  }
  const paidLeaveDays = Math.min(leaveDays, Math.max(0, worker.paidLeaveDaysPerMonth));
  unpaidLeaveDays += leaveDays - paidLeaveDays;
  const workUnits = fullDays + halfDays * 0.5 + paidLeaveDays;

  const regularHours = round2(days.reduce((sum, day) => sum + regularHoursOf(day), 0));
  const overtimeHours = round2(days.reduce((sum, day) => sum + (workedUnit(day.status) ? day.overtimeHours : 0), 0));

  const dailyValue = worker.payType === 'MONTHLY' ? worker.baseRate / standardDays : worker.baseRate;
  let basePay: number;
  if (worker.payType === 'HOURLY') basePay = (regularHours + paidLeaveDays * FULL_DAY_HOURS) * worker.baseRate;
  else if (worker.payType === 'MONTHLY') basePay = dailyValue * Math.min(workUnits, standardDays);
  else basePay = dailyValue * workUnits;

  const hourlyBase = worker.payType === 'HOURLY' ? worker.baseRate : dailyValue / FULL_DAY_HOURS;
  const overtimeHourlyRate = money(worker.overtimeRate > 0 ? worker.overtimeRate : hourlyBase * 1.5);
  const overtimePay = overtimeHours * (worker.overtimeRate > 0 ? worker.overtimeRate : hourlyBase * 1.5);

  const dayPay = (day: PayslipDay) => (worker.payType === 'HOURLY' ? regularHoursOf(day) * worker.baseRate : dailyValue * workedUnit(day.status));
  let sundayDays = 0;
  let sundayPay = 0;
  let holidayDays = 0;
  let holidayPay = 0;
  for (const day of days) {
    const unit = workedUnit(day.status);
    if (!unit) continue;
    if (holidaySet.has(day.date)) {
      holidayDays += unit;
      if (worker.holidayPayEnabled) holidayPay += dayPay(day) * ((worker.holidayPayPercent - 100) / 100);
    } else if (isSunday(day.date)) {
      sundayDays += unit;
      if (worker.sundayPayEnabled) sundayPay += dayPay(day) * ((worker.sundayPayPercent - 100) / 100);
    }
  }

  const pieces = input.pieces.map((piece) => ({ ...piece, amount: money(piece.amount) }));
  const pieceTotal = pieces.reduce((sum, piece) => sum + piece.amount, 0);
  const byKind = (kind: PayslipAdjustmentKind) =>
    input.adjustments.filter((item) => item.kind === kind).map((item) => ({ ...item, amount: money(Math.abs(item.amount)) }));
  const bonuses = byKind('BONUS');
  const advances = byKind('ADVANCE');
  const penalties = byKind('PENALTY');
  const sum = (items: { amount: number }[]) => items.reduce((total, item) => total + item.amount, 0);
  const bonusTotal = sum(bonuses);
  const advanceTotal = sum(advances);
  const penaltyTotal = sum(penalties);

  const rounded = {
    basePay: money(basePay),
    overtimePay: money(overtimePay),
    sundayPay: money(sundayPay),
    holidayPay: money(holidayPay),
  };
  const gross = rounded.basePay + rounded.overtimePay + rounded.sundayPay + rounded.holidayPay + pieceTotal + bonusTotal;
  const insuranceSalary = worker.insuranceEnabled ? money(worker.insuranceSalary) : 0;
  const insuranceEmployee = money(insuranceSalary * EMPLOYEE_INSURANCE_RATE);
  const insuranceEmployer = money(insuranceSalary * EMPLOYER_INSURANCE_RATE);
  const deductions = insuranceEmployee + advanceTotal + penaltyTotal;

  return {
    fullDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    absentDays,
    workUnits,
    regularHours,
    overtimeHours,
    overtimeHourlyRate,
    ...rounded,
    sundayDays,
    holidayDays,
    pieces,
    pieceTotal,
    bonuses,
    bonusTotal,
    gross,
    insuranceSalary,
    insuranceEmployee,
    insuranceEmployer,
    advances,
    advanceTotal,
    penalties,
    penaltyTotal,
    deductions,
    net: gross - deductions,
  };
}
