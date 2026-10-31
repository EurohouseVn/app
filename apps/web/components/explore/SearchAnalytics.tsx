'use client';

import { useEffect } from 'react';
import { createSearchAnalyticsSignal } from '@/lib/public-analytics';

export function SearchAnalytics({ query, resultCount }: { query: string; resultCount: number }) {
  useEffect(() => {
    const signal = createSearchAnalyticsSignal(query, resultCount);
    if (signal) window.dispatchEvent(new CustomEvent('eurohouse:analytics', { detail: signal }));
  }, [query, resultCount]);
  return null;
}
