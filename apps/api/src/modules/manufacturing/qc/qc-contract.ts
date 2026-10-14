export type QualityCheck = { code: string; passed: boolean; measuredValue?: number | string; note?: string };
export type QualityRecord = { productionJobReference: string; checks: QualityCheck[]; inspectedBy: string; inspectedAt: string };

export function qualityRecordPassed(record: QualityRecord) {
  return record.checks.length > 0 && record.checks.every((check) => check.passed);
}
