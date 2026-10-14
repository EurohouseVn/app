import { Injectable } from '@nestjs/common';

export type NestingPiece = { id: string; widthMm: number; heightMm: number; quantity: number; allowRotation?: boolean };
export type SheetSize = { widthMm: number; heightMm: number };
export type NestingPlacement = { id: string; x: number; y: number; widthMm: number; heightMm: number; rotated: boolean };
type SheetState = { placements: NestingPlacement[]; cursorX: number; cursorY: number; rowHeight: number };

@Injectable()
export class NestingEngine {
  nest(pieces: NestingPiece[], sheet: SheetSize) {
    const expanded = pieces.flatMap((piece) => Array.from({ length: Math.max(0, Math.trunc(piece.quantity)) }, (_, index) => ({ ...piece, id: `${piece.id}:${index + 1}` })))
      .sort((a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm);
    const sheets: SheetState[] = [];
    for (const piece of expanded) {
      let placed = false;
      for (const candidate of sheets) {
        if (this.place(candidate, piece, sheet)) { placed = true; break; }
      }
      if (!placed) {
        const candidate: SheetState = { placements: [], cursorX: 0, cursorY: 0, rowHeight: 0 };
        if (!this.place(candidate, piece, sheet)) throw new Error(`Piece ${piece.id} does not fit the configured sheet.`);
        sheets.push(candidate);
      }
    }
    return sheets.map((item, index) => ({ sheetNo: index + 1, widthMm: sheet.widthMm, heightMm: sheet.heightMm, placements: item.placements }));
  }

  private place(target: SheetState, piece: NestingPiece & { id: string }, sheet: SheetSize) {
    const orientations = [{ width: piece.widthMm, height: piece.heightMm, rotated: false }];
    if (piece.allowRotation) orientations.push({ width: piece.heightMm, height: piece.widthMm, rotated: true });
    for (const orientation of orientations) {
      let x = target.cursorX;
      let y = target.cursorY;
      let rowHeight = target.rowHeight;
      if (x + orientation.width > sheet.widthMm) { x = 0; y += rowHeight; rowHeight = 0; }
      if (x + orientation.width <= sheet.widthMm && y + orientation.height <= sheet.heightMm) {
        target.placements.push({ id: piece.id, x, y, widthMm: orientation.width, heightMm: orientation.height, rotated: orientation.rotated });
        target.cursorX = x + orientation.width;
        target.cursorY = y;
        target.rowHeight = Math.max(rowHeight, orientation.height);
        return true;
      }
    }
    return false;
  }
}
