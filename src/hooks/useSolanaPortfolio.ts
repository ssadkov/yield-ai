import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
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
  const { wallet } = useWallet();
  const [address, setAddress] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [totalValueUsd, setTotalValueUsd] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const addressRef = useRef<string | null>(null);

  useEffect(() => {
    const derivedAddress = getSolanaWalletAddress(wallet ?? null);
    setAddress(derivedAddress);
    addressRef.current = derivedAddress;
    if (!derivedAddress) {
      setTokens([]);
      setTotalValueUsd(null);
    }
  }, [wallet]);

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

