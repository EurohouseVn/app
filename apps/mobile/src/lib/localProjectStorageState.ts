const ANONYMOUS_SCOPE = 'anonymous';

function normalizeScope(scope: string | null | undefined) {
  const normalized = String(scope ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return normalized || ANONYMOUS_SCOPE;
}

export function localProjectStorageKey(baseKey: string, scope: string | null | undefined) {
  return `${baseKey}:${normalizeScope(scope)}`;
}
