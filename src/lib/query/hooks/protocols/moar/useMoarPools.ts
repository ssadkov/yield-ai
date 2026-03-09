'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { STALE_TIME } from '@/lib/query/config';
import type { InvestmentData } from '@/types/investments';

interface MoarPoolsResponse {
  success: boolean;
  data: InvestmentData[];
  count?: number;
}

async function fetchMoarPools(): Promise<MoarPoolsResponse> {
  const response = await fetch('/api/protocols/moar/pools');
  if (!response.ok) {
    throw new Error(`Failed to fetch Moar pools: ${response.status}`);
  }
  const json = await response.json();
  if (!json.success) {
    throw new Error('Failed to fetch Moar pools');
  }
  return json;
}

/**
 * Fetches Moar Market protocol pools (APR, deposit info).
 * Uses 5min stale time as pool data changes infrequently.
 */
export function useMoarPools(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.protocols.moar.pools(),
    queryFn: fetchMoarPools,
    staleTime: STALE_TIME.POOLS,
    enabled: options?.enabled ?? true,
  });
}
