export type TechnicalTruthClassification =
  | 'V2_MATCH_TECHNICAL'
  | 'LEGACY_MATCH_TECHNICAL'
  | 'BOTH_MATCH'
  | 'BOTH_DIFFER'
  | 'NOT_COMPARABLE'
  | 'MISSING_TECHNICAL_TRUTH';

export type TechnicalTruthDifference = {
  entity: string;
  field: string;
  approvedExpected?: unknown;
  legacyValue?: unknown;
  v2Value?: unknown;
  delta?: { legacy?: number; v2?: number };
  classification: TechnicalTruthClassification;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flatten(value: unknown, prefix = '', output: Record<string, unknown> = {}): Record<string, unknown> {
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, output);
  } else {
    output[prefix || '$'] = value;
  }
  return output;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => stable(item)).sort());
  if (isRecord(value)) return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])));
  return JSON.stringify(value);
}

function numericDelta(expected: unknown, value: unknown): number | undefined {
  return typeof expected === 'number' && typeof value === 'number' ? value - expected : undefined;
}

export function technicalTruthDiff(entity: string, approvedExpected: unknown, legacy: unknown, v2: unknown): TechnicalTruthDifference[] {
  const expectedFields = flatten(approvedExpected);
  const legacyFields = flatten(legacy);
  const v2Fields = flatten(v2);
  const fields = [...new Set([...Object.keys(expectedFields), ...Object.keys(legacyFields), ...Object.keys(v2Fields)])].sort();
  return fields.map((field) => {
    const expectedValue = expectedFields[field];
    const legacyValue = legacyFields[field];
    const v2Value = v2Fields[field];
    if (!(field in expectedFields)) {
      return { entity, field, legacyValue, v2Value, classification: 'MISSING_TECHNICAL_TRUTH', reason: 'Approved technical expected value is missing.' };
    }
    if (!(field in legacyFields) || !(field in v2Fields)) {
      return { entity, field, approvedExpected: expectedValue, legacyValue, v2Value, classification: 'NOT_COMPARABLE', reason: 'Legacy or V2 output is missing this field.' };
    }
    const legacyMatches = stable(legacyValue) === stable(expectedValue);
    const v2Matches = stable(v2Value) === stable(expectedValue);
    const delta = { legacy: numericDelta(expectedValue, legacyValue), v2: numericDelta(expectedValue, v2Value) };
    const normalizedDelta = delta.legacy === undefined && delta.v2 === undefined ? undefined : delta;
    if (legacyMatches && v2Matches) return { entity, field, approvedExpected: expectedValue, legacyValue, v2Value, delta: normalizedDelta, classification: 'BOTH_MATCH', reason: 'Both engines match approved technical truth.' };
    if (v2Matches) return { entity, field, approvedExpected: expectedValue, legacyValue, v2Value, delta: normalizedDelta, classification: 'V2_MATCH_TECHNICAL', reason: 'V2 matches approved technical truth; legacy differs.' };
    if (legacyMatches) return { entity, field, approvedExpected: expectedValue, legacyValue, v2Value, delta: normalizedDelta, classification: 'LEGACY_MATCH_TECHNICAL', reason: 'Legacy matches approved technical truth; V2 differs.' };
    return { entity, field, approvedExpected: expectedValue, legacyValue, v2Value, delta: normalizedDelta, classification: 'BOTH_DIFFER', reason: 'Both engines differ from approved technical truth.' };
  });
}
