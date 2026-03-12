'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { STALE_TIME } from '@/lib/query/config';

export interface AavePool {
  asset: string;
  provider: string;
  totalAPY: number;
  depositApy: number;
  borrowAPY: number;
  token: string;
  protocol: string;
  poolType: string;
  liquidityRate: number;
  variableBorrowRate: number;
  liquidityIndex: string;
  variableBorrowIndex: string;
  priceInMarketRef: string;
  decimals: number;
}

interface AavePoolsResponse {
  success: boolean;
  data: AavePool[];
  count?: number;
  message?: string;
  error?: string;
}

async function fetchAavePools(): Promise<AavePoolsResponse> {
  const response = await fetch('/api/protocols/aave/pools');
  if (!response.ok) {
    throw new Error(`Failed to fetch Aave pools: ${response.status}`);
  }
  const json: AavePoolsResponse = await response.json();
  if (!json.success) {
    throw new Error(json.error || json.message || 'Failed to fetch Aave pools');
  }
  return json;
}

/**
 * Fetches Aave pools (APR / APY data).
 * Uses 5min stale time as pool data changes infrequently.
 */
export function useAavePools(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.protocols.aave.pools(),
    queryFn: fetchAavePools,
    staleTime: STALE_TIME.POOLS,
    enabled: options?.enabled ?? true,
  });
}

