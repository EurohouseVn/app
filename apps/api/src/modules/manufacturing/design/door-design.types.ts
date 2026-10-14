export type DoorDesignRevisionStatus = 'DRAFT' | 'RELEASED' | 'SUPERSEDED';

export interface GeometryBox {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface DoorOpening {
  id: string;
  kind: 'DOOR' | 'WINDOW' | 'FIXED' | 'COMPOSITE';
  geometry: GeometryBox;
  attributes?: Record<string, unknown>;
}

export interface DoorPanel {
  id: string;
  openingId?: string;
  parentPanelId?: string;
  kind: 'LEAF' | 'FIXED' | 'TRANSOM' | 'SIDELIGHT';
  operation: 'SWING' | 'SLIDE' | 'TILT' | 'FIXED' | 'FOLD';
  geometry: GeometryBox;
  attributes?: Record<string, unknown>;
}

export interface DoorMember {
  id: string;
  role: string;
  geometry: { lengthMm: number; orientation: 'HORIZONTAL' | 'VERTICAL' | 'OTHER' };
  attributes?: Record<string, unknown>;
}

export interface DoorConnection {
  id: string;
  fromComponentId: string;
  toComponentId: string;
  type: string;
  attributes?: Record<string, unknown>;
}

export interface DoorGlazingPanel {
  id: string;
  panelId?: string;
  glassIntent: string;
  geometry: GeometryBox;
  constraints?: Record<string, unknown>;
}

export interface DoorHardwareIntent {
  id: string;
  componentId: string;
  role: string;
  quantity: number;
  unit: string;
  attributes?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
}

export interface CanonicalDoorDesignRevision {
  id: string;
  designStableKey: string;
  revisionNumber: number;
  status: DoorDesignRevisionStatus;
  category: 'DOOR' | 'WINDOW' | 'FACADE' | 'PARTITION' | 'CUSTOM';
  openingType: string;
  widthMm: number;
  heightMm: number;
  leafCount: number;
  handing: 'LEFT' | 'RIGHT' | 'DOUBLE' | 'NONE';
  openingDirection: 'INWARD' | 'OUTWARD' | 'SLIDING' | 'FIXED' | 'NONE';
  openings: DoorOpening[];
  panels: DoorPanel[];
  members: DoorMember[];
  connections: DoorConnection[];
  glazingPanels: DoorGlazingPanel[];
  hardwareIntent: DoorHardwareIntent[];
  constraints?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
}
