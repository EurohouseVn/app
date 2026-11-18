// Pure display logic for the Quản lý xưởng screens (no React Native imports, unit-tested).

export type DayStatus = 'PRESENT' | 'HALF' | 'LEAVE' | 'UNPAID_LEAVE' | 'ABSENT';
export type DaySegment = 'FULL' | 'HALF' | 'OFF';

export function daySummary(rows: Array<{ status: DayStatus; overtimeHours: number }>) {
  let full = 0;
  let half = 0;
  let off = 0;
  let overtimeHours = 0;
  for (const row of rows) {
    if (row.status === 'PRESENT') full += 1;
    else if (row.status === 'HALF') half += 1;
    else off += 1;
    overtimeHours += row.overtimeHours || 0;
  }
  return { full, half, off, overtimeHours: Math.round(overtimeHours * 100) / 100 };
}

/** Nút nào trong bộ 3 nút Đủ / ½ / Nghỉ đang sáng. */
export function segmentOf(status: DayStatus | undefined): DaySegment | null {
  if (!status) return null;
  if (status === 'PRESENT') return 'FULL';
  if (status === 'HALF') return 'HALF';
  return 'OFF';
}

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-');
  return `${monthNumber}/${year}`;
}

export function canMarkDay(date: string, today: string, monthClosed: boolean): { editable: boolean; reason?: string } {
  if (monthClosed) return { editable: false, reason: `Tháng ${monthLabel(date.slice(0, 7))} đã chốt lương` };
  if (date > today) return { editable: false, reason: 'Chưa tới ngày này' };
  return { editable: true };
}

export function leaveLeft(quota: number, used: number): number {
  return Math.max(0, quota - used);
}

export function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index === 0 ? remainder : 0));
}

export function moveMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export const STATUS_LABEL: Record<DayStatus, string> = {
  PRESENT: 'Đủ công',
  HALF: 'Nửa công',
  LEAVE: 'Nghỉ phép',
  UNPAID_LEAVE: 'Nghỉ không lương',
  ABSENT: 'Vắng',
};
