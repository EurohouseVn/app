import type { MaterialCategory } from '../material-roles';
import type { CanonicalDoorDesignRevision } from '../design/door-design.types';

export interface MaterialRequirement {
  id: string;
  category: MaterialCategory;
  role: string;
  componentId: string;
  quantity: number;
  unit: string;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  attributes: Record<string, unknown>;
  constraints: Record<string, unknown>;
  sourceRule: string;
}

export interface RuleDiagnostic {
  code: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  componentId?: string;
}

export interface RuleEngineResult {
  engineVersion: string;
  rulePackVersion: string;
  requirements: MaterialRequirement[];
  diagnostics: RuleDiagnostic[];
  rawLegacyResult?: unknown;
}

export interface RuleEngine {
  evaluate(
    design: CanonicalDoorDesignRevision,
    context?: Record<string, unknown>,
  ): Promise<RuleEngineResult>;
}
