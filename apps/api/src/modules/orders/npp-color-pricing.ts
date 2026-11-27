import { BadRequestException } from '@nestjs/common';

/** Hai dòng giá trong một màu: bó nguyên (chưa bóc vỏ nilon) và nhôm trần (không gồm vỏ). */
export type NppPriceBasis = 'BUNDLE' | 'BARE';

export type NppColorWeighLine = { colorCode: string; basis: NppPriceBasis; actualKg: number; unitPricePerKg: number };

export type NppColorPricingInput = {
  /** Kg theo tỷ trọng của từng màu trong đơn; mỗi màu này phải có kg cân thực. */
  theoreticalKgByColor: Record<string, number>;
  lines: NppColorWeighLine[];
  discountAmount?: number;
  surchargeAmount?: number;
};

const EPS = 0.01;

/**
 * Chốt giá đơn giao theo từng màu. Mỗi màu cân và tính tiền riêng (giá mỗi màu khác nhau), trong một màu tách hai dòng:
 * bó nguyên và nhôm trần, mỗi dòng có kg và đơn giá riêng. Kg thực của màu không được thấp hơn kg theo tỷ trọng.
 */
export function calculateNppColorPricing(input: NppColorPricingInput) {
  const colors = Object.keys(input.theoreticalKgByColor);
  const seen = new Set<string>();
  const lines: Array<NppColorWeighLine & { amount: number }> = [];
  for (const raw of input.lines) {
    const colorCode = String(raw.colorCode ?? '').trim();
    const basis = raw.basis;
    const actualKg = Number(raw.actualKg ?? 0);
    const unitPricePerKg = Number(raw.unitPricePerKg ?? 0);
    if (!colors.includes(colorCode)) throw new BadRequestException(`Màu ${colorCode || '(trống)'} không có trong đơn.`);
    if (basis !== 'BUNDLE' && basis !== 'BARE') throw new BadRequestException(`Dòng giá của màu ${colorCode} phải là bó nguyên hoặc nhôm trần.`);
    if (!Number.isFinite(actualKg) || actualKg < 0) throw new BadRequestException(`Kg cân của màu ${colorCode} không hợp lệ.`);
    if (actualKg === 0) continue;
    if (!Number.isFinite(unitPricePerKg) || unitPricePerKg <= 0) throw new BadRequestException(`Nhập đơn giá cho màu ${colorCode} (${basis === 'BUNDLE' ? 'bó nguyên' : 'nhôm trần'}).`);
    const key = `${colorCode}:${basis}`;
    if (seen.has(key)) throw new BadRequestException(`Màu ${colorCode} bị nhập trùng một dòng giá.`);
    seen.add(key);
    const kg = Number(actualKg.toFixed(2));
    const price = Math.round(unitPricePerKg);
    lines.push({ colorCode, basis, actualKg: kg, unitPricePerKg: price, amount: Math.round(kg * price) });
  }

  const colorTotals = colors.map((colorCode) => {
    const mine = lines.filter((l) => l.colorCode === colorCode);
    const actualKg = Number(mine.reduce((sum, l) => sum + l.actualKg, 0).toFixed(2));
    const theoreticalKg = Number(input.theoreticalKgByColor[colorCode].toFixed(2));
    if (actualKg <= 0) throw new BadRequestException(`Nhập kg cân thực cho màu ${colorCode}.`);
    if (actualKg + EPS < theoreticalKg) {
      throw new BadRequestException(`Kg thực của màu ${colorCode} (${actualKg} kg) không được thấp hơn kg theo tỷ trọng (${theoreticalKg} kg).`);
    }
    return { colorCode, theoreticalKg, actualKg, amount: mine.reduce((sum, l) => sum + l.amount, 0) };
  });

  const discountAmount = Math.round(Number(input.discountAmount ?? 0));
  const surchargeAmount = Math.round(Number(input.surchargeAmount ?? 0));
  if (!Number.isFinite(discountAmount) || discountAmount < 0) throw new BadRequestException('Giảm giá không hợp lệ.');
  if (!Number.isFinite(surchargeAmount) || surchargeAmount < 0) throw new BadRequestException('Phụ phí không hợp lệ.');
  const actualTotalKg = Number(colorTotals.reduce((sum, c) => sum + c.actualKg, 0).toFixed(2));
  const subtotalAmount = colorTotals.reduce((sum, c) => sum + c.amount, 0);
  const finalTotalAmount = subtotalAmount - discountAmount + surchargeAmount;
  if (finalTotalAmount <= 0) throw new BadRequestException('Thành tiền sau giảm giá và phụ phí phải lớn hơn 0.');
  return {
    lines,
    colorTotals,
    actualTotalKg,
    subtotalAmount,
    discountAmount,
    surchargeAmount,
    finalTotalAmount,
    /** Đơn giá bình quân, để các màn hình cũ vẫn có một con số đ/kg. */
    finalUnitPricePerKg: Math.round(subtotalAmount / actualTotalKg),
  };
}
