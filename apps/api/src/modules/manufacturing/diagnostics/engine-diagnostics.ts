import type { RuleDiagnostic } from '../rules/rule-engine';

export const ENGINE_DIAGNOSTIC = {
  profileRoleUnresolved: 'PROFILE_ROLE_UNRESOLVED',
  profileNotCompatible: 'PROFILE_NOT_COMPATIBLE',
  glassRuleMissing: 'GLASS_RULE_MISSING',
  hardwareRuleMissing: 'HARDWARE_RULE_MISSING',
  datasetNotReleased: 'DATASET_NOT_RELEASED',
  ruleNotVerified: 'RULE_NOT_VERIFIED',
  dimensionOutOfRange: 'DIMENSION_OUT_OF_RANGE',
  finishNotCompatible: 'FINISH_NOT_COMPATIBLE',
  missingTechnicalSource: 'MISSING_TECHNICAL_SOURCE',
} as const;

export type EngineDiagnosticCode = (typeof ENGINE_DIAGNOSTIC)[keyof typeof ENGINE_DIAGNOSTIC];

export function hasBlockingDiagnostics(diagnostics: RuleDiagnostic[]): boolean {
  return diagnostics.some((item) => item.severity === 'ERROR');
}

export function diagnostic(
  code: EngineDiagnosticCode,
  message: string,
  componentId?: string,
  severity: RuleDiagnostic['severity'] = 'ERROR',
): RuleDiagnostic {
  return { code, message, componentId, severity };
}
