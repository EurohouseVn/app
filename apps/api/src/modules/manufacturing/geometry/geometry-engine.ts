import { Injectable } from '@nestjs/common';
import type { CanonicalDoorDesignRevision, DoorMember } from '../design/door-design.types';

export interface GeometryDiagnostic {
  code: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  componentId?: string;
}

export interface GeometryResult {
  members: DoorMember[];
  diagnostics: GeometryDiagnostic[];
}

@Injectable()
export class GeometryEngine {
  expand(design: CanonicalDoorDesignRevision): GeometryResult {
    if (design.members.length > 0)
      return { members: design.members.map((member) => ({ ...member })), diagnostics: [] };
    const members: DoorMember[] = [
      {
        id: 'frame-left',
        role: 'FRAME_OUTER',
        geometry: { lengthMm: design.heightMm, orientation: 'VERTICAL' },
      },
      {
        id: 'frame-right',
        role: 'FRAME_OUTER',
        geometry: { lengthMm: design.heightMm, orientation: 'VERTICAL' },
      },
      {
        id: 'frame-top',
        role: 'FRAME_OUTER',
        geometry: { lengthMm: design.widthMm, orientation: 'HORIZONTAL' },
      },
      {
        id: 'frame-bottom',
        role: 'FRAME_OUTER',
        geometry: { lengthMm: design.widthMm, orientation: 'HORIZONTAL' },
      },
    ];
    return {
      members,
      diagnostics: [
        {
          code: 'GEOMETRY_DERIVED_OUTER_FRAME',
          severity: 'INFO',
          message: 'Outer frame members were derived from the design envelope.',
        },
      ],
    };
  }
}
