import { Injectable } from '@nestjs/common';

export type LinearCutPiece = {
  id: string;
  materialKey: string;
  lengthMm: number;
  quantity: number;
  startAngleDeg?: number;
  endAngleDeg?: number;
  machining?: Record<string, unknown>[];
  sourceComponentId?: string;
  label?: string;
  toleranceMm?: number;
};
export type AvailableRemnant = { id: string; materialKey: string; lengthMm: number };
export type CuttingOptions = { stockLengthMm: number; kerfMm: number; minimumReusableRemnantMm: number };
export type CutBar = {
  source: 'STOCK' | 'REMNANT';
  sourceId?: string;
  materialKey: string;
  stockLengthMm: number;
  pieces: Omit<LinearCutPiece, 'quantity' | 'materialKey'>[];
  usedMm: number;
  wasteMm: number;
  reusableRemnantMm: number;
};

@Injectable()
export class CuttingEngine {
  optimize(pieces: LinearCutPiece[], remnants: AvailableRemnant[], options: CuttingOptions): CutBar[] {
    if (options.stockLengthMm <= 0 || options.kerfMm < 0) throw new Error('Invalid cutting configuration.');
    const expanded = pieces.flatMap((piece) =>
      Array.from({ length: Math.max(0, Math.trunc(piece.quantity)) }, (_, index) => ({
        id: `${piece.id}:${index + 1}`,
        materialKey: piece.materialKey,
        lengthMm: piece.lengthMm,
        startAngleDeg: piece.startAngleDeg,
        endAngleDeg: piece.endAngleDeg,
        machining: piece.machining,
        sourceComponentId: piece.sourceComponentId,
        label: piece.label,
        toleranceMm: piece.toleranceMm,
      })),
    ).sort((a, b) => b.lengthMm - a.lengthMm);
    const bins: CutBar[] = remnants
      .filter((remnant) => remnant.lengthMm > 0)
      .map((remnant) => this.newBar(remnant.materialKey, remnant.lengthMm, 'REMNANT', remnant.id));

    for (const piece of expanded) {
      if (piece.lengthMm <= 0 || piece.lengthMm > options.stockLengthMm) {
        throw new Error(`Cut ${piece.id} is outside the allowed stock length.`);
      }
      let target = bins
        .filter((bin) => bin.materialKey === piece.materialKey && this.remaining(bin, options.kerfMm) >= piece.lengthMm)
        .sort((a, b) => this.remaining(a, options.kerfMm) - this.remaining(b, options.kerfMm))[0];
      if (!target) {
        target = this.newBar(piece.materialKey, options.stockLengthMm, 'STOCK');
        bins.push(target);
      }
      target.pieces.push({ id: piece.id, lengthMm: piece.lengthMm, startAngleDeg: piece.startAngleDeg, endAngleDeg: piece.endAngleDeg, machining: piece.machining, sourceComponentId: piece.sourceComponentId, label: piece.label, toleranceMm: piece.toleranceMm });
      target.usedMm = target.pieces.reduce((sum, item) => sum + item.lengthMm, 0)
        + Math.max(0, target.pieces.length - 1) * options.kerfMm;
      target.wasteMm = Math.max(0, target.stockLengthMm - target.usedMm);
      target.reusableRemnantMm = target.wasteMm >= options.minimumReusableRemnantMm ? target.wasteMm : 0;
    }
    return bins.filter((bin) => bin.pieces.length > 0);
  }

  private newBar(materialKey: string, stockLengthMm: number, source: CutBar['source'], sourceId?: string): CutBar {
    return { source, sourceId, materialKey, stockLengthMm, pieces: [], usedMm: 0, wasteMm: stockLengthMm, reusableRemnantMm: stockLengthMm };
  }

  private remaining(bar: CutBar, kerfMm: number) {
    return bar.stockLengthMm - bar.usedMm - (bar.pieces.length > 0 ? kerfMm : 0);
  }
}
