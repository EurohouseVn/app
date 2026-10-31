export type PublicAnalyticsSignal = {
  name: 'public_search' | 'public_search_zero_result';
  payload: { query: string; resultCount: number };
};

export function createSearchAnalyticsSignal(query: string, resultCount: number): PublicAnalyticsSignal | null {
  const normalized = query.trim();
  if (!normalized) return null;
  return {
    name: resultCount === 0 ? 'public_search_zero_result' : 'public_search',
    payload: { query: normalized, resultCount },
  };
}
