import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet as useAptosWallet } from "@aptos-labs/wallet-adapter-react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { getSolanaWalletAddress } from "@/lib/wallet/getSolanaWalletAddress";
import { Token } from "@/lib/types/token";

interface SolanaPortfolioState {
  address: string | null;
  tokens: Token[];
  totalValueUsd: number | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useSolanaPortfolio(): SolanaPortfolioState {
  // 1) Aptos cross-chain wallet (Trust / derived) — даёт solanaWallet внутри себя.
  const { wallet: aptosWallet } = useAptosWallet();
  // 2) Обычный Solana-адаптер — независимое подключение Solana.
  const { publicKey: solanaPublicKey, connected: solanaConnected, wallet: solanaWallet } = useSolanaWallet();
  const [address, setAddress] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [totalValueUsd, setTotalValueUsd] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const addressRef = useRef<string | null>(null);
  
  // Force re-render trigger for adapter state changes (Phantom doesn't trigger React updates)
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    // Приоритет: если есть Aptos cross-chain (Trust/Phantom) с solanaWallet внутри — считаем это "основным" адресом Solana.
    // Если нет — fallback на обычный Solana-кошелёк из @solana/wallet-adapter-react.
    const derivedAddress = getSolanaWalletAddress(aptosWallet ?? null);
    
    // Try multiple sources for Solana address:
    // 1. Hook's publicKey (may be out of sync with adapter)
    // 2. Adapter's publicKey directly (more reliable for Phantom)
    const hookAddress = solanaPublicKey ? solanaPublicKey.toBase58() : null;
    const adapterAddress = solanaWallet?.adapter?.publicKey?.toBase58() ?? null;
    const fallbackAddress = hookAddress ?? adapterAddress;
    
    const effectiveAddress = derivedAddress ?? fallbackAddress;

    console.log('[useSolanaPortfolio] Address detection:', {
      aptosWalletName: aptosWallet?.name ?? null,
      derivedAddress,
      hookAddress,
      adapterAddress,
      fallbackAddress,
      effectiveAddress,
      hasSolanaPublicKey: !!solanaPublicKey,
      solanaConnected,
      solanaWalletName: solanaWallet?.adapter?.name ?? null,
      solanaAdapterConnected: solanaWallet?.adapter?.connected ?? false,
    });

    setAddress(effectiveAddress);
    addressRef.current = effectiveAddress;
    if (!effectiveAddress) {
      setTokens([]);
      setTotalValueUsd(null);
    }
  }, [aptosWallet, solanaPublicKey, solanaConnected, solanaWallet]);

  // Poll adapter state for Phantom (which doesn't trigger React state updates properly)
  useEffect(() => {
    if (!solanaWallet?.adapter) return;
    
    // If we already have an address, no need to poll
    if (address) return;
    
    const checkAdapter = () => {
      const adapterPk = solanaWallet.adapter.publicKey?.toBase58() ?? null;
      if (adapterPk && adapterPk !== addressRef.current) {
        console.log('[useSolanaPortfolio] Adapter publicKey detected via polling:', adapterPk);
        setAddress(adapterPk);
        addressRef.current = adapterPk;
        forceUpdate(n => n + 1);
      }
    };
    
    // Check immediately and then poll
    checkAdapter();
    const interval = setInterval(checkAdapter, 500);
    
    // Stop polling after 10 seconds
    const timeout = setTimeout(() => clearInterval(interval), 10000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [solanaWallet, address]);

  const refresh = useCallback(async () => {
    if (!addressRef.current) {
      setTokens([]);
      setTotalValueUsd(null);
      return;
    }

    const currentAddress = addressRef.current;
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/solana/portfolio?address=${currentAddress}`,
        { cache: "no-store" },
      );

      const data = await response.json();
      
      console.log(`[useSolanaPortfolio] 📥 API response received:`, {
        ok: response.ok,
        status: response.status,
        tokensCount: data.tokens?.length || 0,
        totalValueUsd: data.totalValueUsd,
        tokens: data.tokens?.map((t: any) => ({
          address: t.address,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          price: t.price,
          value: t.value,
          hasLogoUrl: !!t.logoUrl,
          logoUrl: t.logoUrl,
        })) || [],
      });
      
      if (addressRef.current !== currentAddress) {
        return;
      }

      // Even if response is not ok, try to use the data if available
      // This allows partial data to be displayed if RPC fails but we have cached data
      if (!response.ok) {
        console.warn("Solana portfolio API returned error:", response.status, data.error);
        // Don't throw error, just use empty/default data
        setTokens(data.tokens ?? []);
        setTotalValueUsd(
          typeof data.totalValueUsd === "number" ? data.totalValueUsd : null,
        );
        return;
      }

      console.log(`[useSolanaPortfolio] ✅ Setting tokens and totalValueUsd:`, {
        tokensCount: data.tokens?.length || 0,
        totalValueUsd: data.totalValueUsd,
      });
      
      setTokens(data.tokens ?? []);
      setTotalValueUsd(
        typeof data.totalValueUsd === "number" ? data.totalValueUsd : null,
      );
    } catch (error) {
      console.error("Error fetching Solana portfolio:", error);
      // Don't clear tokens on error - keep existing data if available
      // This prevents UI flickering when there's a temporary network issue
      if (addressRef.current === currentAddress) {
        // Only clear if we don't have any tokens yet
        if (tokens.length === 0) {
          setTokens([]);
          setTotalValueUsd(null);
        }
      }
    } finally {
      if (addressRef.current === currentAddress) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (address) {
      refresh();
    }
  }, [address, refresh]);

  return {
    address,
    tokens,
    totalValueUsd,
    isLoading,
    refresh,
  };
}

