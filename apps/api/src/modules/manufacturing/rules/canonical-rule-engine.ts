import { Injectable } from '@nestjs/common';
import { DoorDesignValidator } from '../design/door-design.validator';
import type { CanonicalDoorDesignRevision } from '../design/door-design.types';
import { GeometryEngine } from '../geometry/geometry-engine';
import { assertMaterialRole } from '../material-roles';
import type { MaterialRequirement, RuleEngine, RuleEngineResult } from './rule-engine';
import { versionIdentity } from './version-identity';

const RULE_PACK = {
  name: 'canonical-opening-foundation',
  rules: [
    'MEMBER_TO_LINEAR_REQUIREMENT',
    'GLAZING_PANEL_TO_GLASS_REQUIREMENT',
    'HARDWARE_INTENT_TO_COUNT_REQUIREMENT',
  ],
  unit: 'millimetre',
} as const;

const ENGINE_MANIFEST = {
  name: 'workshop-os-manufacturing-core',
  geometry: 'explicit-member-or-envelope-v1',
  requirements: 'material-requirement-v1',
} as const;

@Injectable()
export class CanonicalRuleEngine implements RuleEngine {
  readonly engineVersion = versionIdentity('engine', ENGINE_MANIFEST);
  readonly rulePackVersion = versionIdentity('rules', RULE_PACK);

  constructor(
    private readonly validator: DoorDesignValidator,
    private readonly geometry: GeometryEngine,
  ) {}

  async evaluate(design: CanonicalDoorDesignRevision): Promise<RuleEngineResult> {
    const validation = this.validator.assertValid(design);
    const geometry = this.geometry.expand(design);
    const requirements: MaterialRequirement[] = [];

    for (const member of geometry.members) {
      const role = assertMaterialRole(member.role);
      requirements.push({
        id: `req:${member.id}`,
        category: role.category,
        role: role.code,
        componentId: member.id,
        quantity: 1,
        unit: 'piece',
        lengthMm: member.geometry.lengthMm,
        attributes: { orientation: member.geometry.orientation, ...(member.attributes ?? {}) },
        constraints: {},
        sourceRule: 'MEMBER_TO_LINEAR_REQUIREMENT',
      });
    }
    for (const panel of design.glazingPanels) {
      requirements.push({
        id: `req:${panel.id}`,
        category: 'GLASS',
        role: 'GLASS',
        componentId: panel.id,
        quantity: 1,
        unit: 'panel',
        widthMm: panel.geometry.widthMm,
        heightMm: panel.geometry.heightMm,
        attributes: { glassIntent: panel.glassIntent },
        constraints: panel.constraints ?? {},
        sourceRule: 'GLAZING_PANEL_TO_GLASS_REQUIREMENT',
      });
    }
    for (const hardware of design.hardwareIntent) {
      const role = assertMaterialRole(hardware.role);
      requirements.push({
        id: `req:${hardware.id}`,
        category: role.category,
        role: role.code,
        componentId: hardware.componentId,
        quantity: hardware.quantity,
        unit: hardware.unit,
        attributes: hardware.attributes ?? {},
        constraints: hardware.constraints ?? {},
        sourceRule: 'HARDWARE_INTENT_TO_COUNT_REQUIREMENT',
      });
    }

    return {
      engineVersion: this.engineVersion,
      rulePackVersion: this.rulePackVersion,
      requirements,
      diagnostics: [
        ...validation.warnings.map((message) => ({
          code: 'DESIGN_WARNING',
          severity: 'WARNING' as const,
          message,
        })),
        ...geometry.diagnostics,
      ],
    };
  }
}
