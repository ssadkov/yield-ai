'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { STALE_TIME } from '@/lib/query/config';

export interface MoarPosition {
  poolId: number;
  assetName: string;
  balance: string;
  value: string;
  type: 'deposit';
  assetInfo: {
    symbol: string;
    logoUrl: string | null;
    decimals: number;
    name: string;
  };
}

interface MoarUserPositionsResponse {
  success: boolean;
  data: MoarPosition[];
}

async function fetchMoarPositions(address: string): Promise<MoarPosition[]> {
  const response = await fetch(
    `/api/protocols/moar/userPositions?address=${encodeURIComponent(address)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch Moar positions: ${response.status}`);
  }
  const json: MoarUserPositionsResponse = await response.json();
  if (!json.success) {
    throw new Error('Failed to fetch Moar positions');
  }
  return json.data ?? [];
}

interface UseMoarQueryOptions {
  enabled?: boolean;
  refetchOnMount?: boolean | 'always';
}

/**
 * Fetches user positions for Moar Market protocol by wallet address.
 * Uses 1min stale time. Disabled when address is missing or too short.
 *
 * Consumers can override refetchOnMount (e.g. 'always' in ManagePositions)
 * without changing global cache behaviour for other components.
 */
export function useMoarPositions(
  address: string | undefined,
  options?: UseMoarQueryOptions
) {
  const enabled =
    (options?.enabled ?? true) && Boolean(address && address.length >= 10);

  return useQuery({
    queryKey: queryKeys.protocols.moar.userPositions(address ?? ''),
    queryFn: () => fetchMoarPositions(address!),
    staleTime: STALE_TIME.POSITIONS,
    enabled,
    refetchOnMount: options?.refetchOnMount,
  });
}
