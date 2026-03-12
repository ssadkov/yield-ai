'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { STALE_TIME } from '@/lib/query/config';

export interface AavePosition {
  underlying_asset: string;
  symbol: string;
  name: string;
  decimals: number;
  deposit_amount: number;
  deposit_value_usd: number;
  borrow_amount: number;
  borrow_value_usd: number;
  usage_as_collateral_enabled: boolean;
  liquidity_index: string;
  variable_borrow_index: string;
}

interface AavePositionsResponse {
  success: boolean;
  data?: AavePosition[];
  error?: string;
  message?: string;
}

async function fetchAavePositions(address: string): Promise<AavePosition[]> {
  const response = await fetch(
    `/api/protocols/aave/positions?address=${encodeURIComponent(address)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch Aave positions: ${response.status}`);
  }
  const json: AavePositionsResponse = await response.json();
  if (!json.success) {
    throw new Error(json.error || json.message || 'Failed to fetch Aave positions');
  }
  return json.data ?? [];
}

interface UseAavePositionsOptions {
  enabled?: boolean;
  refetchOnMount?: boolean | 'always';
}

/**
 * Fetches user positions for Aave by wallet address.
 * Uses 1min stale time. Disabled when address is missing or too short.
 *
 * Consumers can override refetchOnMount (e.g. 'always' in ManagePositions)
 * without changing global cache behaviour for other components.
 */
export function useAavePositions(
  address: string | undefined,
  options?: UseAavePositionsOptions
) {
  const enabled =
    (options?.enabled ?? true) && Boolean(address && address.length >= 10);

  return useQuery({
    queryKey: queryKeys.protocols.aave.userPositions(address ?? ''),
    queryFn: () => fetchAavePositions(address!),
    staleTime: STALE_TIME.POSITIONS,
    enabled,
    refetchOnMount: options?.refetchOnMount,
  });
}

