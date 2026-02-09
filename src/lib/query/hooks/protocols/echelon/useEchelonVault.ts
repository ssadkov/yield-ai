'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { STALE_TIME } from '@/lib/query/config';

export interface EchelonVaultData {
  collaterals?: {
    data?: Array<{ key?: { inner?: string }; value?: string }>;
  };
  [key: string]: unknown;
}

interface EchelonVaultResponse {
  success: boolean;
  data: EchelonVaultData;
}

async function fetchEchelonVault(address: string): Promise<EchelonVaultData> {
  const response = await fetch(
    `/api/protocols/echelon/vault?address=${encodeURIComponent(address)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch Echelon vault: ${response.status}`);
  }
  const json: EchelonVaultResponse = await response.json();
  if (!json.success) {
    throw new Error('Failed to fetch Echelon vault');
  }
  return json.data ?? { collaterals: { data: [] } };
}

/**
 * Fetches user vault/collateral data for Echelon protocol by wallet address.
 * Uses 1min stale time. Disabled when address is missing or too short.
 */
export function useEchelonVault(address: string | undefined, options?: { enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && Boolean(address && address.length >= 10);

  return useQuery({
    queryKey: queryKeys.protocols.echelon.vault(address ?? ''),
    queryFn: () => fetchEchelonVault(address!),
    staleTime: STALE_TIME.POSITIONS,
    enabled,
  });
}
