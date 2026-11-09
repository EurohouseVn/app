const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export type BusinessDateParts = {
  year: string;
  month: string;
  day: string;
  compact: string;
};

export function businessDateUtcRange(now: Date): { start: Date; end: Date } {
  const { year, month, day } = businessDateParts(now);
  const start = new Date(`${year}-${month}-${day}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function businessDateParts(now: Date, timeZone = VIETNAM_TIME_ZONE): BusinessDateParts {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('Ngày tạo mã không hợp lệ.');
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  const year = values.year;
  const month = values.month;
  const day = values.day;
  if (!year || !month || !day) throw new Error('Không xác định được ngày nghiệp vụ.');
  return { year, month, day, compact: `${year}${month}${day}` };
}

function normalizedNppCode(value: string): string {
  let normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  while (normalized.startsWith('NPP-')) normalized = normalized.slice(4);
  if (!normalized) throw new Error('Mã NPP không hợp lệ.');
  return normalized;
}

function sequencePart(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence <= 0) throw new Error('Số thứ tự phải là số nguyên dương.');
  return String(sequence).padStart(2, '0');
}

export function formatNppPoNumber(nppCode: string, now: Date, sequence: number): string {
  return `NPP-${normalizedNppCode(nppCode)}-${businessDateParts(now).compact}-${sequencePart(sequence)}`;
}

export function formatNppInvoiceNumber(nppCode: string, now: Date, sequence: number): string {
  return `HD-${formatNppPoNumber(nppCode, now, sequence)}`;
}
