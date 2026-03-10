'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { isDerivedAptosWallet } from '@/lib/aptosWalletUtils';
import { getSolanaWalletAddress } from '@/lib/wallet/getSolanaWalletAddress';

const DECIBEL_DOMAIN = 'app.decibel.trade';

/**
 * Returns the Aptos address to use for all Decibel API calls (positions, subaccounts, onboard).
 * - For native Aptos wallet: current account.address.
 * - For Solana-derived wallet: derived Aptos address for app.decibel.trade (so Decibel sees the same address as on app.decibel.trade).
 */
export function useDecibelAptosAddress(): {
  decibelAddress: string | null;
  isLoading: boolean;
} {
  const { account, wallet } = useWallet();
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);
  const [isLoadingDerived, setIsLoadingDerived] = useState(false);

  const isDerived = Boolean(wallet && isDerivedAptosWallet(wallet));
  const solanaPubkey = getSolanaWalletAddress(wallet ?? null);

  useEffect(() => {
    if (!isDerived || !solanaPubkey) {
      setDerivedAddress(null);
      setIsLoadingDerived(false);
      return;
    }
    let cancelled = false;
    setIsLoadingDerived(true);
    setDerivedAddress(null);
    const url = `/api/aptos/derived-address?solanaPublicKey=${encodeURIComponent(solanaPubkey)}&domain=${encodeURIComponent(DECIBEL_DOMAIN)}`;
    fetch(url)
      .then((r) => r.json())
      .then((data: { aptosAddress?: string; error?: string }) => {
        if (cancelled) return;
        if (data?.aptosAddress) {
          setDerivedAddress(data.aptosAddress);
        }
      })
      .catch(() => {
        if (!cancelled) setDerivedAddress(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDerived(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDerived, solanaPubkey]);

  if (!account?.address) {
    return { decibelAddress: null, isLoading: false };
  }

  if (isDerived) {
    return {
      decibelAddress: derivedAddress,
      isLoading: isLoadingDerived,
    };
  }

  return {
    decibelAddress: account.address.toString(),
    isLoading: false,
  };
}
