import { BadRequestException } from '@nestjs/common';

export type AccessoryPriceMode = 'AUTO' | 'MANUAL';

/** Giá bán phụ kiện: tự động = giá nhập cộng % lãi, làm tròn lên 1.000 đ; thủ công = đúng số NPP nhập. */
export function computeAccessorySalePrice(input: { unitCost: number; markupPercent: number; mode: AccessoryPriceMode; manualPrice: number }): number {
  if (input.mode === 'MANUAL') return Math.max(0, Math.round(input.manualPrice));
  if (!(input.unitCost > 0)) return 0;
  return Math.ceil((input.unitCost * (1 + input.markupPercent / 100)) / 1000 - 1e-9) * 1000;
}

export function normalizeMarkupPercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 500) throw new BadRequestException('Phần trăm lãi phải là số từ 0 đến 500.');
  return Math.round(n * 100) / 100;
}
