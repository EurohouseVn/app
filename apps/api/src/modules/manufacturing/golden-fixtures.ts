import type { CanonicalDoorDesignRevision } from './design/door-design.types';

function fixture(id: string, widthMm: number, heightMm: number, leafCount: number): CanonicalDoorDesignRevision {
  return {
    id,
    designStableKey: `foundation:${id}`,
    revisionNumber: 1,
    status: 'DRAFT',
    category: heightMm < 1800 ? 'WINDOW' : 'DOOR',
    widthMm,
    heightMm,
    openingType: leafCount > 1 ? 'MULTI_LEAF' : 'SINGLE_LEAF',
    leafCount,
    handing: 'NONE',
    openingDirection: 'INWARD',
    openings: [{ id: `${id}:opening`, kind: heightMm < 1800 ? 'WINDOW' : 'DOOR', geometry: { xMm: 0, yMm: 0, widthMm, heightMm } }],
    panels: [{ id: `${id}:panel`, openingId: `${id}:opening`, kind: 'LEAF', operation: 'SWING', geometry: { xMm: 0, yMm: 0, widthMm, heightMm } }],
    members: [],
    connections: [],
    glazingPanels: [{ id: `${id}:glass`, panelId: `${id}:panel`, glassIntent: 'CLEAR', geometry: { xMm: 80, yMm: 80, widthMm: widthMm - 160, heightMm: heightMm - 160 } }],
    hardwareIntent: [{ id: `${id}:hinge`, componentId: `${id}:panel`, role: 'HINGE', quantity: heightMm >= 2400 ? 4 : 3, unit: 'piece' }],
    constraints: {},
    provenance: { fixture: true, verificationStatus: 'CALCULATED_NOT_VERIFIED' },
  };
}

export const CANDIDATE_GOLDEN_FIXTURES = [
  fixture('single-800x2200', 800, 2200, 1),
  fixture('single-900x2400', 900, 2400, 1),
  fixture('single-1000x2600', 1000, 2600, 1),
  fixture('double-1400x2200', 1400, 2200, 2),
  fixture('double-1600x2400', 1600, 2400, 2),
  fixture('double-1800x2600', 1800, 2600, 2),
  fixture('window-600x600', 600, 600, 1),
  fixture('window-900x1200', 900, 1200, 1),
  fixture('window-1200x1400', 1200, 1400, 2),
  fixture('wide-2400x2200', 2400, 2200, 3),
  fixture('wide-3200x2400', 3200, 2400, 4),
  fixture('tall-1200x3200', 1200, 3200, 2),
] as const;

// Compatibility alias for the Phase 0 deterministic tests. These are candidates,
// never technically verified fixtures, until a reviewer supplies approved sources.
export const FOUNDATION_GOLDEN_FIXTURES = CANDIDATE_GOLDEN_FIXTURES;
