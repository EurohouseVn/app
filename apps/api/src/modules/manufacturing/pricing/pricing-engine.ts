import { Injectable } from '@nestjs/common';
import type { BomLine } from '../bom/bom.service';

export type PriceLookup = { itemType: string; itemKey: string; unit: string; unitPrice: number };

@Injectable()
export class PricingEngine {
  price(lines: BomLine[], prices: PriceLookup[]) {
    const pricedLines = lines.map((line) => {
      const key = line.materialStableKey ?? line.role;
      const price = prices.find((item) => item.itemType === line.category && item.itemKey === key && item.unit === line.unit);
      const unitPrice = price?.unitPrice ?? 0;
      return { ...line, priceKey: key, unitPrice, amount: Math.round(line.quantity * unitPrice), priceResolved: Boolean(price) };
    });
    return {
      lines: pricedLines,
      subtotal: pricedLines.reduce((sum, line) => sum + line.amount, 0),
      unresolved: pricedLines.filter((line) => !line.priceResolved).map((line) => line.id),
    };
  }
}
