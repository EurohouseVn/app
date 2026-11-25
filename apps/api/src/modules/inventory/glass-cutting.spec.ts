import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CUT_OPTIONS, planGlassCutting, type CutSource } from './glass-cutting';

const sheet = (id: string, widthMm: number, heightMm: number, quantity: number, kind: CutSource['kind'] = 'SHEET'): CutSource => ({ id, widthMm, heightMm, quantity, kind });
const opts = (over: Partial<typeof DEFAULT_CUT_OPTIONS> = {}) => ({ ...DEFAULT_CUT_OPTIONS, kerfMm: 0, trimMm: 0, minRemnantMm: 1, ...over });

type Rect = { x: number; y: number; widthMm: number; heightMm: number };

function assertNoOverlapAndInside(plan: ReturnType<typeof planGlassCutting>, kerfMm: number, trimMm: number) {
  for (const s of plan.sheets) {
    for (const p of s.placements) {
      assert.ok(p.x >= trimMm && p.y >= trimMm, 'piece starts inside the trim');
      assert.ok(p.x + p.widthMm <= s.widthMm - trimMm && p.y + p.heightMm <= s.heightMm - trimMm, 'piece ends inside the trim');
    }
    for (let i = 0; i < s.placements.length; i++) {
      for (let j = i + 1; j < s.placements.length; j++) {
        const a = s.placements[i];
        const b = s.placements[j];
        const separated = a.x + a.widthMm + kerfMm <= b.x || b.x + b.widthMm + kerfMm <= a.x || a.y + a.heightMm + kerfMm <= b.y || b.y + b.heightMm + kerfMm <= a.y;
        assert.ok(separated, `pieces ${a.pieceNo} and ${b.pieceNo} overlap or are closer than the kerf`);
      }
    }
  }
}

test('one piece is placed in the top-left corner', () => {
  const plan = planGlassCutting([{ widthMm: 600, heightMm: 900, quantity: 1 }], [sheet('s1', 2440, 3660, 3)], opts());
  assert.equal(plan.sheets.length, 1);
  assert.equal(plan.unplaced.length, 0);
  assert.deepEqual({ x: plan.sheets[0].placements[0].x, y: plan.sheets[0].placements[0].y }, { x: 0, y: 0 });
});

test('trim keeps pieces away from the sheet edge', () => {
  const plan = planGlassCutting([{ widthMm: 600, heightMm: 900, quantity: 1 }], [sheet('s1', 2440, 3660, 1)], opts({ trimMm: 10 }));
  assert.deepEqual({ x: plan.sheets[0].placements[0].x, y: plan.sheets[0].placements[0].y }, { x: 10, y: 10 });
  assertNoOverlapAndInside(plan, 0, 10);
});

test('kerf is kept between neighbouring pieces and decides how many fit per row', () => {
  // 3 x 800 = 2400 + 2 kerf (3 mm) = 2406 <= 2440 in one row; 4th piece needs another row
  const plan = planGlassCutting([{ widthMm: 800, heightMm: 800, quantity: 4 }], [sheet('s1', 2440, 800 * 2 + 3, 1)], opts({ kerfMm: 3 }));
  assert.equal(plan.unplaced.length, 0);
  assertNoOverlapAndInside(plan, 3, 0);
  const rowYs = new Set(plan.sheets[0].placements.map((p) => p.y));
  assert.equal(rowYs.size, 2);
});

test('a piece too big for every sheet is reported as unplaced', () => {
  const plan = planGlassCutting([{ widthMm: 3000, heightMm: 3000, quantity: 1 }], [sheet('s1', 2440, 3660, 2)], opts());
  assert.equal(plan.sheets.length, 0);
  assert.equal(plan.unplaced.length, 1);
});

test('rotation lets a long piece fit and can be switched off', () => {
  const piece = [{ widthMm: 3000, heightMm: 500, quantity: 1 }];
  const withRotation = planGlassCutting(piece, [sheet('s1', 2440, 3660, 1)], opts({ allowRotation: true }));
  assert.equal(withRotation.unplaced.length, 0);
  assert.equal(withRotation.sheets[0].placements[0].rotated, true);
  assert.equal(withRotation.sheets[0].placements[0].widthMm, 500);
  const without = planGlassCutting(piece, [sheet('s1', 2440, 3660, 1)], opts({ allowRotation: false }));
  assert.equal(without.unplaced.length, 1);
});

test('remnants are used before whole sheets, smallest fitting remnant first', () => {
  const plan = planGlassCutting(
    [{ widthMm: 500, heightMm: 500, quantity: 1 }],
    [sheet('whole', 2440, 3660, 5), sheet('big-rem', 1500, 1500, 1, 'REMNANT'), sheet('small-rem', 700, 700, 1, 'REMNANT')],
    opts(),
  );
  assert.equal(plan.sheets.length, 1);
  assert.equal(plan.sheets[0].sourceId, 'small-rem');
});

test('falls back to a whole sheet when no remnant is big enough', () => {
  const plan = planGlassCutting([{ widthMm: 900, heightMm: 900, quantity: 1 }], [sheet('whole', 2440, 3660, 2), sheet('rem', 700, 700, 3, 'REMNANT')], opts());
  assert.equal(plan.sheets[0].sourceId, 'whole');
});

test('never uses more units of a source than its quantity; the rest is unplaced', () => {
  const plan = planGlassCutting([{ widthMm: 2000, heightMm: 3000, quantity: 3 }], [sheet('s1', 2440, 3660, 2)], opts());
  assert.equal(plan.sheets.length, 2);
  assert.equal(plan.unplaced.length, 1);
  assert.equal(plan.totals.sheetsUsed, 2);
});

test('opens a second sheet when the first is full', () => {
  const plan = planGlassCutting([{ widthMm: 2440, heightMm: 3660, quantity: 2 }], [sheet('s1', 2440, 3660, 5)], opts());
  assert.equal(plan.sheets.length, 2);
  assert.equal(plan.unplaced.length, 0);
});

test('without kerf and trim: used area plus remnants equals the sheet area', () => {
  const plan = planGlassCutting(
    [{ widthMm: 600, heightMm: 900, quantity: 3 }, { widthMm: 1200, heightMm: 1000, quantity: 1 }],
    [sheet('s1', 2440, 3660, 2)],
    opts({ minRemnantMm: 1 }),
  );
  for (const s of plan.sheets) {
    const used = s.placements.reduce((sum, p) => sum + p.widthMm * p.heightMm, 0);
    const rem = s.remnants.reduce((sum, r) => sum + r.widthMm * r.heightMm, 0);
    assert.equal(used + rem, s.widthMm * s.heightMm);
  }
});

test('remnants smaller than the minimum side are dropped', () => {
  const plan = planGlassCutting([{ widthMm: 2400, heightMm: 3600, quantity: 1 }], [sheet('s1', 2440, 3660, 1)], opts({ minRemnantMm: 300 }));
  assert.equal(plan.sheets[0].remnants.length, 0);
  const plan2 = planGlassCutting([{ widthMm: 600, heightMm: 900, quantity: 1 }], [sheet('s1', 2440, 3660, 1)], opts({ minRemnantMm: 300 }));
  assert.ok(plan2.sheets[0].remnants.length >= 1);
  for (const r of plan2.sheets[0].remnants) assert.ok(Math.min(r.widthMm, r.heightMm) >= 300);
});

test('remnants never overlap the placed pieces or each other', () => {
  const plan = planGlassCutting([{ widthMm: 700, heightMm: 1100, quantity: 4 }, { widthMm: 400, heightMm: 500, quantity: 3 }], [sheet('s1', 2440, 3660, 3)], opts({ kerfMm: 3, trimMm: 10, minRemnantMm: 100 }));
  const overlap = (a: Rect, b: Rect) => a.x < b.x + b.widthMm && b.x < a.x + a.widthMm && a.y < b.y + b.heightMm && b.y < a.y + a.heightMm;
  for (const s of plan.sheets) {
    const all: Rect[] = [...s.placements, ...s.remnants];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!overlap(all[i], all[j]), 'overlap between pieces/remnants');
  }
});

test('placements stay inside the sheet and respect kerf for a mixed batch', () => {
  const plan = planGlassCutting(
    [{ widthMm: 1000, heightMm: 1500, quantity: 2 }, { widthMm: 650, heightMm: 820, quantity: 5 }, { widthMm: 300, heightMm: 420, quantity: 7 }],
    [sheet('s1', 2440, 3660, 4)],
    opts({ kerfMm: 3, trimMm: 5 }),
  );
  assert.equal(plan.unplaced.length, 0);
  assertNoOverlapAndInside(plan, 3, 5);
  const placed = plan.sheets.reduce((n, s) => n + s.placements.length, 0);
  assert.equal(placed, 14);
});

test('piece numbers are unique and cover every requested piece exactly once', () => {
  const plan = planGlassCutting([{ widthMm: 500, heightMm: 600, quantity: 6 }, { widthMm: 400, heightMm: 400, quantity: 4 }], [sheet('s1', 2440, 3660, 2)], opts({ kerfMm: 3 }));
  const nos = plan.sheets.flatMap((s) => s.placements.map((p) => p.pieceNo)).concat(plan.unplaced.map((u) => u.pieceNo));
  assert.equal(new Set(nos).size, 10);
  assert.equal(nos.length, 10);
});

test('is deterministic and does not mutate its inputs', () => {
  const pieces = [{ widthMm: 500, heightMm: 600, quantity: 3 }, { widthMm: 900, heightMm: 300, quantity: 2 }];
  const sources = [sheet('s1', 2440, 3660, 2), sheet('r1', 1000, 1000, 1, 'REMNANT')];
  const copyP = JSON.stringify(pieces);
  const copyS = JSON.stringify(sources);
  const a = planGlassCutting(pieces, sources, opts({ kerfMm: 3 }));
  const b = planGlassCutting(pieces, sources, opts({ kerfMm: 3 }));
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(pieces), copyP);
  assert.equal(JSON.stringify(sources), copyS);
});

test('totals report waste against the area of the sheets used', () => {
  const plan = planGlassCutting([{ widthMm: 1220, heightMm: 1830, quantity: 4 }], [sheet('s1', 2440, 3660, 1)], opts());
  assert.equal(plan.totals.sheetsUsed, 1);
  assert.equal(plan.totals.wastePercent, 0);
  assert.equal(plan.sheets[0].wastePercent, 0);
});

test('rejects nonsense input instead of looping or returning garbage', () => {
  assert.throws(() => planGlassCutting([{ widthMm: 0, heightMm: 500, quantity: 1 }], [sheet('s1', 2440, 3660, 1)], opts()), /kích thước/i);
  assert.throws(() => planGlassCutting([{ widthMm: 500, heightMm: 500, quantity: -1 }], [sheet('s1', 2440, 3660, 1)], opts()), /số lượng/i);
  assert.throws(() => planGlassCutting([{ widthMm: 500, heightMm: 500, quantity: 1 }], [sheet('s1', 2440, 3660, 1)], opts({ kerfMm: -1 })), /lề cắt/i);
  assert.throws(() => planGlassCutting([{ widthMm: 500, heightMm: 500, quantity: 100000 }], [sheet('s1', 2440, 3660, 1)], opts()), /quá nhiều/i);
});

test('a large batch stays valid and finishes quickly', () => {
  const pieces = [
    { widthMm: 640, heightMm: 910, quantity: 300 },
    { widthMm: 410, heightMm: 530, quantity: 400 },
    { widthMm: 1180, heightMm: 760, quantity: 200 },
    { widthMm: 305, heightMm: 305, quantity: 600 },
  ];
  const started = Date.now();
  const plan = planGlassCutting(pieces, [sheet('s1', 2440, 3660, 500)], opts({ kerfMm: 3, trimMm: 5 }));
  const elapsedMs = Date.now() - started;
  assert.equal(plan.unplaced.length, 0);
  assert.equal(plan.totals.piecesPlaced, 1500);
  assertNoOverlapAndInside(plan, 3, 5);
  assert.ok(elapsedMs < 8000, `took ${elapsedMs} ms`);
});
