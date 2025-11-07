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

      if (!response.ok) {
        throw new Error("Failed to fetch Solana portfolio");
      }

      const data = await response.json();
      if (addressRef.current !== currentAddress) {
        return;
      }

      setTokens(data.tokens ?? []);
      setTotalValueUsd(
        typeof data.totalValueUsd === "number" ? data.totalValueUsd : null,
      );
    } catch (error) {
      console.error(error);
      if (addressRef.current === currentAddress) {
        setTokens([]);
        setTotalValueUsd(null);
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

