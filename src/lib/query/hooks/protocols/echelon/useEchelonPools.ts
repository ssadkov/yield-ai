'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { STALE_TIME } from '@/lib/query/config';
import type { InvestmentData } from '@/types/investments';

interface EchelonPoolsResponse {
  success: boolean;
  data: InvestmentData[];
  stakingAprs?: Record<string, { aprPct: number; source: 'echelon' }>;
}

async function fetchEchelonPools(): Promise<EchelonPoolsResponse> {
  const response = await fetch('/api/protocols/echelon/v2/pools');
  if (!response.ok) {
    throw new Error(`Failed to fetch Echelon pools: ${response.status}`);
  }
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || 'Failed to fetch Echelon pools');
  }
  return json;
}

/**
 * Fetches Echelon protocol pools (v2) with APY, market addresses, and rewards APR.
 * Uses 5min stale time as pool data changes infrequently.
 */
export function useEchelonPools(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.protocols.echelon.poolsV2(),
    queryFn: fetchEchelonPools,
    staleTime: STALE_TIME.POOLS,
    enabled: options?.enabled ?? true,
  });
}
