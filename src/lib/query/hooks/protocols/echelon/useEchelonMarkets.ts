'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { STALE_TIME } from '@/lib/query/config';

interface EchelonMarketsResponse {
  success: boolean;
  data: unknown;
}

async function fetchEchelonMarkets(): Promise<EchelonMarketsResponse> {
  const response = await fetch('/api/protocols/echelon/markets');
  if (!response.ok) {
    throw new Error(`Failed to fetch Echelon markets: ${response.status}`);
  }
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || 'Failed to fetch Echelon markets');
  }
  return json;
}

/**
 * Fetches Echelon markets data from the protocol API (app.echelon.market).
 * Uses 5min stale time as market list changes infrequently.
 */
export function useEchelonMarkets(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.protocols.echelon.markets(),
    queryFn: fetchEchelonMarkets,
    staleTime: STALE_TIME.POOLS,
    enabled: options?.enabled ?? true,
  });
}
