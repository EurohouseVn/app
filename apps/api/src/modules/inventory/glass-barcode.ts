/**
 * Quy tắc mã vạch kính của NPP: `{MÃ ĐẦU}-{CẠNH NGẮN}-{CẠNH DÀI}`.
 * Mã đầu do NPP đặt (2-6 ký tự A-Z, 0-9); hai cạnh tính bằng mm, 4 chữ số, đệm số 0.
 * Cạnh ngắn luôn đứng trước để một kích thước chỉ có một mã.
 * Xem docs/design/NPP_GLASS_BARCODE_STOCK_DESIGN.md mục 3.
 */

export const GLASS_SIDE_MIN_MM = 1;
export const GLASS_SIDE_MAX_MM = 9999;

const PREFIX_PATTERN = /^[A-Z0-9]{2,6}$/;
const CODE_PATTERN = /^([A-Z0-9]{2,6})-(\d{4})-(\d{4})$/;

export type ParsedGlassBarcode = { prefix: string; shortMm: number; longMm: number };

export function normalizeBarcodePrefix(raw: string): string {
  const prefix = (raw ?? '').trim().toUpperCase();
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new Error('Mã đầu phải gồm 2 đến 6 ký tự chữ A-Z hoặc số 0-9, không dấu, không khoảng trắng.');
  }
  return prefix;
}

function normalizeSide(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Kích thước kính không hợp lệ.');
  }
  const side = Math.ceil(value);
  if (side < GLASS_SIDE_MIN_MM || side > GLASS_SIDE_MAX_MM) {
    throw new Error(`Kích thước mỗi cạnh phải từ ${GLASS_SIDE_MIN_MM} đến ${GLASS_SIDE_MAX_MM} mm.`);
  }
  return side;
}

export function buildGlassBarcode(prefixRaw: string, widthMm: number, heightMm: number): string {
  const prefix = normalizeBarcodePrefix(prefixRaw);
  const a = normalizeSide(widthMm);
  const b = normalizeSide(heightMm);
  const shortMm = Math.min(a, b);
  const longMm = Math.max(a, b);
  return `${prefix}-${String(shortMm).padStart(4, '0')}-${String(longMm).padStart(4, '0')}`;
}

/** Đọc ngược mã quét được. Trả null nếu sai dạng hoặc không đúng chuẩn (cạnh ngắn phải đứng trước). */
export function parseGlassBarcode(raw: string): ParsedGlassBarcode | null {
  const match = CODE_PATTERN.exec((raw ?? '').trim().toUpperCase());
  if (!match) return null;
  const shortMm = Number(match[2]);
  const longMm = Number(match[3]);
  if (shortMm < GLASS_SIDE_MIN_MM || longMm < GLASS_SIDE_MIN_MM) return null;
  if (shortMm > longMm) return null;
  return { prefix: match[1], shortMm, longMm };
}
