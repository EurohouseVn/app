/**
 * Tính hướng cắt kính cho NPP (giai đoạn 2 của docs/design/NPP_GLASS_BARCODE_STOCK_DESIGN.md mục 5).
 *
 * Xếp hình chữ nhật 2D kiểu guillotine (cắt suốt từ mép này sang mép kia, đúng cách cắt kính thật), nhiều tấm,
 * có lề cắt (hao mạch giữa hai tấm kề nhau), mép bỏ mỗi cạnh, cho phép xoay 90 độ và ưu tiên dùng tấm dư trước.
 *
 * Một lượt xếp theo một chiến lược (thứ tự tấm, cách đặt hướng, cách chia khoảng trống) không phải lúc nào cũng tốt:
 * ví dụ 4 tấm 1220 x 1830 vừa khít một tấm 2440 x 3660 nhưng chiến lược "vừa nhất" lại xoay tấm đầu và xếp rơi mất một tấm.
 * Vì vậy hàm chạy nhiều chiến lược cố định và giữ phương án tốt nhất. Hàm thuần: không đụng cơ sở dữ liệu,
 * không đổi dữ liệu vào, cùng đầu vào luôn cho cùng kết quả.
 */

export type CutSourceKind = 'SHEET' | 'REMNANT' | 'CUT_PIECE';

export type CutPieceInput = { widthMm: number; heightMm: number; quantity: number };
export type CutSource = { id: string; widthMm: number; heightMm: number; quantity: number; kind: CutSourceKind };
export type CutOptions = { kerfMm: number; trimMm: number; minRemnantMm: number; allowRotation: boolean };

export const DEFAULT_CUT_OPTIONS: CutOptions = { kerfMm: 3, trimMm: 0, minRemnantMm: 300, allowRotation: true };

export const MAX_CUT_PIECES = 2000;
const MAX_SIDE_MM = 99999;

export type CutPlacement = { pieceNo: number; x: number; y: number; widthMm: number; heightMm: number; rotated: boolean };
export type CutRemnant = { x: number; y: number; widthMm: number; heightMm: number };
export type CutSheetPlan = {
  sheetNo: number;
  sourceId: string;
  sourceKind: CutSourceKind;
  widthMm: number;
  heightMm: number;
  placements: CutPlacement[];
  remnants: CutRemnant[];
  usedAreaMm2: number;
  wasteAreaMm2: number;
  wastePercent: number;
};
export type CutUnplaced = { pieceNo: number; widthMm: number; heightMm: number };
export type CutPlanResult = {
  sheets: CutSheetPlan[];
  unplaced: CutUnplaced[];
  totals: { sheetsUsed: number; piecesPlaced: number; usedAreaMm2: number; wasteAreaMm2: number; wastePercent: number };
};

type Free = { x: number; y: number; w: number; h: number };
type OpenSheet = { source: CutSource; sheetNo: number; free: Free[]; placements: CutPlacement[] };
type Piece = { pieceNo: number; w: number; h: number };
type Strategy = { sort: 'area' | 'longside' | 'height'; orient: 'best' | 'plain' | 'tall'; split: 'max' | 'A' | 'B' };

const STRATEGIES: Strategy[] = [];
for (const sort of ['area', 'longside', 'height'] as const) {
  for (const orient of ['plain', 'best', 'tall'] as const) {
    for (const split of ['A', 'B', 'max'] as const) STRATEGIES.push({ sort, orient, split });
  }
}

const KIND_RANK: Record<CutSourceKind, number> = { REMNANT: 0, SHEET: 1, CUT_PIECE: 2 };
const area = (r: { w: number; h: number }) => (r.w > 0 && r.h > 0 ? r.w * r.h : 0);
const round2 = (value: number) => Math.round(value * 100) / 100;

function side(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_SIDE_MM) {
    throw new Error(`Kích thước phải từ 1 đến ${MAX_SIDE_MM} mm.`);
  }
  return Math.ceil(value);
}

function validateOptions(options: CutOptions) {
  if (!Number.isFinite(options.kerfMm) || options.kerfMm < 0 || options.kerfMm > 50) throw new Error('Lề cắt phải từ 0 đến 50 mm.');
  if (!Number.isFinite(options.trimMm) || options.trimMm < 0 || options.trimMm > 200) throw new Error('Mép bỏ phải từ 0 đến 200 mm.');
  if (!Number.isFinite(options.minRemnantMm) || options.minRemnantMm < 1) throw new Error('Cạnh nhỏ nhất của tấm dư phải từ 1 mm.');
}

function expandPieces(pieces: CutPieceInput[]): Piece[] {
  const out: Piece[] = [];
  let total = 0;
  for (const piece of pieces) {
    const w = side(piece.widthMm);
    const h = side(piece.heightMm);
    if (!Number.isInteger(piece.quantity) || piece.quantity < 0) throw new Error('Số lượng phải là số nguyên không âm.');
    total += piece.quantity;
    if (total > MAX_CUT_PIECES) throw new Error(`Quá nhiều tấm cần cắt (tối đa ${MAX_CUT_PIECES} tấm một lần).`);
    for (let i = 0; i < piece.quantity; i++) out.push({ pieceNo: out.length + 1, w, h });
  }
  return out;
}

function sortPieces(pieces: Piece[], sort: Strategy['sort']): Piece[] {
  const byArea = (a: Piece, b: Piece) => b.w * b.h - a.w * a.h;
  const byLong = (a: Piece, b: Piece) => Math.max(b.w, b.h) - Math.max(a.w, a.h);
  const byHeight = (a: Piece, b: Piece) => b.h - a.h;
  const order = sort === 'area' ? [byArea, byLong] : sort === 'longside' ? [byLong, byArea] : [byHeight, byArea];
  return [...pieces].sort((a, b) => order[0](a, b) || order[1](a, b) || a.pieceNo - b.pieceNo);
}

/** Chia khoảng trống sau khi đặt tấm: A = nửa phải cao bằng tấm; B = nửa phải cao hết khoảng trống; max = chọn cách để lại khối lớn nhất. */
function splitFree(f: Free, pw: number, ph: number, kerf: number, split: Strategy['split']): Free[] {
  const rw = f.w - pw - kerf;
  const rh = f.h - ph - kerf;
  const rightA: Free = { x: f.x + pw + kerf, y: f.y, w: rw, h: ph };
  const bottomA: Free = { x: f.x, y: f.y + ph + kerf, w: f.w, h: rh };
  const rightB: Free = { x: f.x + pw + kerf, y: f.y, w: rw, h: f.h };
  const bottomB: Free = { x: f.x, y: f.y + ph + kerf, w: pw, h: rh };
  let useB = split === 'B';
  if (split === 'max') useB = Math.max(area(rightB), area(bottomB)) > Math.max(area(rightA), area(bottomA));
  return (useB ? [rightB, bottomB] : [rightA, bottomA]).filter((r) => r.w > 0 && r.h > 0);
}

type Fit = { freeIndex: number; rotated: boolean; w: number; h: number; short: number; long: number };

function bestFit(sheet: OpenSheet, piece: Piece, allowRotation: boolean, orient: Strategy['orient']): Fit | null {
  const orientations: Array<{ w: number; h: number; rotated: boolean }> = [{ w: piece.w, h: piece.h, rotated: false }];
  if (allowRotation && piece.w !== piece.h) orientations.push({ w: piece.h, h: piece.w, rotated: true });
  if (orient === 'tall' && orientations.length === 2 && piece.w > piece.h) orientations.reverse();

  const evaluate = (list: typeof orientations): Fit | null => {
    let best: Fit | null = null;
    sheet.free.forEach((f, freeIndex) => {
      for (const o of list) {
        if (o.w > f.w || o.h > f.h) continue;
        const lw = f.w - o.w;
        const lh = f.h - o.h;
        const candidate: Fit = { freeIndex, rotated: o.rotated, w: o.w, h: o.h, short: Math.min(lw, lh), long: Math.max(lw, lh) };
        if (!best || candidate.short < best.short || (candidate.short === best.short && candidate.long < best.long)) best = candidate;
      }
    });
    return best;
  };

  if (orient === 'best') return evaluate(orientations);
  // plain / tall: thử hướng ưu tiên (đầu danh sách) trước, chỉ đổi hướng khi hướng đó không đặt được ở đâu cả.
  return evaluate(orientations.slice(0, 1)) ?? (orientations.length > 1 ? evaluate(orientations.slice(1)) : null);
}

function place(sheet: OpenSheet, piece: Piece, fit: Fit, kerf: number, split: Strategy['split']) {
  const f = sheet.free[fit.freeIndex];
  sheet.placements.push({ pieceNo: piece.pieceNo, x: f.x, y: f.y, widthMm: fit.w, heightMm: fit.h, rotated: fit.rotated });
  sheet.free.splice(fit.freeIndex, 1, ...splitFree(f, fit.w, fit.h, kerf, split));
}

function runStrategy(allPieces: Piece[], sources: CutSource[], options: CutOptions, strategy: Strategy): CutPlanResult {
  const pieces = sortPieces(allPieces, strategy.sort);
  const used = new Map<string, number>();
  const open: OpenSheet[] = [];
  const unplaced: CutUnplaced[] = [];
  const trim = options.trimMm;

  for (const piece of pieces) {
    let placed = false;
    for (const sheet of open) {
      const fit = bestFit(sheet, piece, options.allowRotation, strategy.orient);
      if (fit) {
        place(sheet, piece, fit, options.kerfMm, strategy.split);
        placed = true;
        break;
      }
    }
    if (placed) continue;

    for (const source of sources) {
      if ((used.get(source.id) ?? 0) >= source.quantity) continue;
      const w = source.widthMm - 2 * trim;
      const h = source.heightMm - 2 * trim;
      if (w <= 0 || h <= 0) continue;
      const sheet: OpenSheet = { source, sheetNo: open.length + 1, free: [{ x: trim, y: trim, w, h }], placements: [] };
      const fit = bestFit(sheet, piece, options.allowRotation, strategy.orient);
      if (!fit) continue;
      used.set(source.id, (used.get(source.id) ?? 0) + 1);
      place(sheet, piece, fit, options.kerfMm, strategy.split);
      open.push(sheet);
      placed = true;
      break;
    }
    if (!placed) unplaced.push({ pieceNo: piece.pieceNo, widthMm: piece.w, heightMm: piece.h });
  }

  const sheets: CutSheetPlan[] = open.map((sheet) => {
    const sheetArea = sheet.source.widthMm * sheet.source.heightMm;
    const usedArea = sheet.placements.reduce((sum, p) => sum + p.widthMm * p.heightMm, 0);
    const remnants = sheet.free
      .filter((f) => Math.min(f.w, f.h) >= options.minRemnantMm)
      .map((f) => ({ x: f.x, y: f.y, widthMm: f.w, heightMm: f.h }))
      .sort((a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm || a.y - b.y || a.x - b.x);
    return {
      sheetNo: sheet.sheetNo,
      sourceId: sheet.source.id,
      sourceKind: sheet.source.kind,
      widthMm: sheet.source.widthMm,
      heightMm: sheet.source.heightMm,
      placements: [...sheet.placements].sort((a, b) => a.pieceNo - b.pieceNo),
      remnants,
      usedAreaMm2: usedArea,
      wasteAreaMm2: sheetArea - usedArea,
      wastePercent: sheetArea ? round2(((sheetArea - usedArea) / sheetArea) * 100) : 0,
    };
  });

  const totalArea = sheets.reduce((sum, s) => sum + s.widthMm * s.heightMm, 0);
  const totalUsed = sheets.reduce((sum, s) => sum + s.usedAreaMm2, 0);
  return {
    sheets,
    unplaced: unplaced.sort((a, b) => a.pieceNo - b.pieceNo),
    totals: {
      sheetsUsed: sheets.length,
      piecesPlaced: sheets.reduce((n, s) => n + s.placements.length, 0),
      usedAreaMm2: totalUsed,
      wasteAreaMm2: totalArea - totalUsed,
      wastePercent: totalArea ? round2(((totalArea - totalUsed) / totalArea) * 100) : 0,
    },
  };
}

/** Ít tấm rơi nhất, rồi ít diện tích kính dùng nhất (dùng tấm dư/nhỏ hơn), rồi để lại mảnh dư lớn nhất. */
function score(plan: CutPlanResult): [number, number, number] {
  const sourceArea = plan.sheets.reduce((sum, s) => sum + s.widthMm * s.heightMm, 0);
  const largestRemnant = plan.sheets.reduce((best, s) => Math.max(best, ...s.remnants.map((r) => r.widthMm * r.heightMm), 0), 0);
  return [plan.unplaced.length, sourceArea, -largestRemnant];
}

function better(a: [number, number, number], b: [number, number, number]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

export function planGlassCutting(piecesInput: CutPieceInput[], sourcesInput: CutSource[], optionsInput: CutOptions): CutPlanResult {
  validateOptions(optionsInput);
  const options = { ...optionsInput };
  const pieces = expandPieces(piecesInput);
  const sources = sourcesInput
    .filter((s) => s.quantity > 0)
    .map((s) => ({ ...s, widthMm: Math.ceil(s.widthMm), heightMm: Math.ceil(s.heightMm) }))
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.widthMm * a.heightMm - b.widthMm * b.heightMm || a.id.localeCompare(b.id));

  let best: CutPlanResult | null = null;
  let bestScore: [number, number, number] = [Infinity, Infinity, Infinity];
  for (const strategy of STRATEGIES) {
    const plan = runStrategy(pieces, sources, options, strategy);
    const planScore = score(plan);
    if (!best || better(planScore, bestScore)) {
      best = plan;
      bestScore = planScore;
    }
    if (planScore[0] === 0 && plan.totals.wasteAreaMm2 === 0) break; // không thể tốt hơn
  }
  return best!;
}
