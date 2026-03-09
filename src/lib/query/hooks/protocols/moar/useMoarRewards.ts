'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { STALE_TIME } from '@/lib/query/config';

export interface MoarRewardItem {
  side: 'supply' | 'borrow';
  poolInner: string;
  rewardPoolInner: string;
  tokenAddress: string;
  amountRaw: string;
  amount: number;
  decimals: number;
  symbol: string;
  name: string;
  logoUrl?: string | null;
  price?: string | null;
  usdValue: number;
  farming_identifier: string;
  reward_id: string;
  claimable_amount: string;
  token_info?: {
    symbol: string;
    decimals: number;
    price: string;
    amount: number;
    logoUrl?: string;
  };
}

interface MoarRewardsResponse {
  success: boolean;
  data: MoarRewardItem[];
  totalUsd: number;
  error?: string;
}

async function fetchMoarRewards(
  address: string
): Promise<MoarRewardsResponse> {
  const response = await fetch(
    `/api/protocols/moar/rewards?address=${encodeURIComponent(address)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch Moar rewards: ${response.status}`);
  }
  const json: MoarRewardsResponse = await response.json();
  if (!json.success) {
    throw new Error(json.error || 'Failed to fetch Moar rewards');
  }
  return {
    success: json.success,
    data: json.data ?? [],
    totalUsd: json.totalUsd ?? 0,
  };
}

interface UseMoarRewardsOptions {
  enabled?: boolean;
  refetchOnMount?: boolean | 'always';
}

/**
 * Fetches claimable rewards for a user in Moar Market protocol by wallet address.
 * Uses 1min stale time. Disabled when address is missing or too short.
 *
 * Consumers can override refetchOnMount (e.g. 'always' in ManagePositions)
 * without affecting other components.
 */
export function useMoarRewards(
  address: string | undefined,
  options?: UseMoarRewardsOptions
) {
  const enabled =
    (options?.enabled ?? true) && Boolean(address && address.length >= 10);

  return useQuery({
    queryKey: queryKeys.protocols.moar.rewards(address ?? ''),
    queryFn: () => fetchMoarRewards(address!),
    staleTime: STALE_TIME.POSITIONS,
    enabled,
    refetchOnMount: options?.refetchOnMount,
  });
}
