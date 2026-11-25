/**
 * Quy tắc mã vạch kính phía web NPP: `{MÃ ĐẦU}-{CẠNH NGẮN}-{CẠNH DÀI}` (mm, 4 chữ số).
 * Phải giống hệt apps/api/src/modules/inventory/glass-barcode.ts; máy chủ vẫn là nơi quyết định mã thật,
 * hàm này chỉ dùng để xem trước và in nhãn. Có test so khớp trong glassBarcode.test.ts.
 */
export const GLASS_SIDE_MIN_MM = 1;
export const GLASS_SIDE_MAX_MM = 9999;

const PREFIX_PATTERN = /^[A-Z0-9]{2,6}$/;

export function normalizeBarcodePrefix(raw: string): string | null {
  const prefix = (raw ?? '').trim().toUpperCase();
  return PREFIX_PATTERN.test(prefix) ? prefix : null;
}

function normalizeSide(value: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const side = Math.ceil(value);
  return side >= GLASS_SIDE_MIN_MM && side <= GLASS_SIDE_MAX_MM ? side : null;
}

/** Trả null khi mã đầu hoặc kích thước chưa hợp lệ (để giao diện báo thay vì ném lỗi). */
export function previewGlassBarcode(prefixRaw: string, widthMm: number, heightMm: number): string | null {
  const prefix = normalizeBarcodePrefix(prefixRaw);
  const a = normalizeSide(widthMm);
  const b = normalizeSide(heightMm);
  if (!prefix || a === null || b === null) return null;
  return `${prefix}-${String(Math.min(a, b)).padStart(4, '0')}-${String(Math.max(a, b)).padStart(4, '0')}`;
}

export type ParsedGlassBarcode = { prefix: string; shortMm: number; longMm: number };

/** Đọc ngược mã quét được; null nếu sai dạng hoặc không đúng chuẩn (cạnh ngắn phải đứng trước). Giống bản API. */
export function parseGlassBarcode(raw: string): ParsedGlassBarcode | null {
  const match = /^([A-Z0-9]{2,6})-(\d{4})-(\d{4})$/.exec((raw ?? '').trim().toUpperCase());
  if (!match) return null;
  const shortMm = Number(match[2]);
  const longMm = Number(match[3]);
  if (shortMm < GLASS_SIDE_MIN_MM || longMm < GLASS_SIDE_MIN_MM || shortMm > longMm) return null;
  return { prefix: match[1], shortMm, longMm };
}
