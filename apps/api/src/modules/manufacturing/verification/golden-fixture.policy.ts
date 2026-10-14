import { BadRequestException } from '@nestjs/common';

const requiredFixtureChecks = ['topology', 'materialRoles', 'profileIdentity', 'profileQuantity', 'cutDimensions', 'glass', 'gasket', 'hardware', 'bom', 'traceProvenance'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function goldenFixtureApprovalBlockers(input: {
  status: string;
  actualOutput: unknown;
  datasetStatus?: string;
  sourceType?: string;
  sourceReviewedAt?: Date | null;
  sourceReviewState?: string;
  evidenceKind?: string;
  expectedOutputStatus?: string;
  expectedOutput?: unknown;
  ruleStates: string[];
  comparisonStatuses: string[];
  openTechnicalIssues?: number;
  reviewChecks: unknown;
}): string[] {
  const blockers: string[] = [];
  if (input.status !== 'TECHNICAL_REVIEW') blockers.push('FIXTURE_NOT_IN_TECHNICAL_REVIEW');
  if (!input.actualOutput) blockers.push('FIXTURE_HAS_NO_CALCULATED_OUTPUT');
  if (input.evidenceKind !== 'REAL_MANUFACTURED') blockers.push('REAL_MANUFACTURED_FIXTURE_REQUIRED');
  if (input.expectedOutputStatus !== 'APPROVED') blockers.push('APPROVED_EXPECTED_OUTPUT_REQUIRED');
  if (input.datasetStatus !== 'RELEASED') blockers.push('DATASET_NOT_RELEASED');
  if (!input.sourceType || input.sourceType === 'LEGACY_DATA' || !input.sourceReviewedAt || input.sourceReviewState !== 'APPROVED') blockers.push('MISSING_REVIEWED_TECHNICAL_SOURCE');
  if (!input.ruleStates.length || input.ruleStates.some((state) => state !== 'APPROVED')) blockers.push('RULE_NOT_VERIFIED');
  if (!input.comparisonStatuses.length) blockers.push('CALCULATION_COMPARISON_MISSING');
  if (input.comparisonStatuses.some((status) => !['MATCH', 'EXPLAINED_DIFFERENCE'].includes(status))) blockers.push('UNEXPLAINED_CALCULATION_DIFFERENCE');
  if ((input.openTechnicalIssues ?? 0) > 0) blockers.push('OPEN_TECHNICAL_ISSUE');
  const reviewChecks = isRecord(input.reviewChecks) ? input.reviewChecks : {};
  const applicability = isRecord(input.expectedOutput) && isRecord(input.expectedOutput.applicability) ? input.expectedOutput.applicability : {};
  const applicableChecks = [
    ...requiredFixtureChecks,
    ...(applicability.cuttingAngles === true ? ['cuttingAngles'] : []),
    ...(applicability.machining === true ? ['machining'] : []),
  ];
  if (applicableChecks.some((check) => reviewChecks[check] !== true)) {
    blockers.push('TECHNICAL_REVIEW_CHECKS_INCOMPLETE');
  }
  return blockers;
}

export function assertGoldenFixtureApproval(input: Parameters<typeof goldenFixtureApprovalBlockers>[0]) {
  const blockers = goldenFixtureApprovalBlockers(input);
  if (blockers.length) throw new BadRequestException({ message: 'Golden fixture cannot be verified.', diagnostics: blockers });
}
