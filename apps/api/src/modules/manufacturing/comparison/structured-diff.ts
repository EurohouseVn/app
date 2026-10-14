export type StructuredDifference = {
  entity: string;
  field: string;
  legacyValue?: unknown;
  v2Value?: unknown;
  delta?: number;
  classification: 'MATCH' | 'UNEXPLAINED_DIFFERENCE' | 'NOT_COMPARABLE';
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => stable(item)).sort());
  if (isRecord(value)) {
    return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])));
  }
  return JSON.stringify(value);
}

function flatten(value: unknown, prefix = '', output: Record<string, unknown> = {}): Record<string, unknown> {
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, output);
  } else {
    output[prefix || '$'] = value;
  }
  return output;
}

export function structuredDiff(entity: string, left: unknown, right: unknown): StructuredDifference[] {
  const leftFields = flatten(left);
  const rightFields = flatten(right);
  const fields = [...new Set([...Object.keys(leftFields), ...Object.keys(rightFields)])].sort();
  return fields.map((field) => {
    const legacyValue = leftFields[field];
    const v2Value = rightFields[field];
    if (!(field in leftFields) || !(field in rightFields)) {
      return { entity, field, legacyValue, v2Value, classification: 'NOT_COMPARABLE', reason: 'Field is absent from one output.' };
    }
    if (stable(legacyValue) === stable(v2Value)) {
      return { entity, field, legacyValue, v2Value, delta: 0, classification: 'MATCH', reason: '' };
    }
    const delta = typeof legacyValue === 'number' && typeof v2Value === 'number' ? v2Value - legacyValue : undefined;
    return { entity, field, legacyValue, v2Value, delta, classification: 'UNEXPLAINED_DIFFERENCE', reason: '' };
  });
}
