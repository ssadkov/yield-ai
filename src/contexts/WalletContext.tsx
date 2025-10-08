'use client';

import { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { useWallet as useAptosWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosPortfolioService } from '@/lib/services/aptos/portfolio';

interface PortfolioToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  amount: string;
  price: string | null;
  value: string | null;
}

interface WalletContextType {
  address?: string;
  tokens: PortfolioToken[];
  refreshPortfolio: () => Promise<void>;
  isRefreshing: boolean;
}

const WalletDataContext = createContext<WalletContextType | undefined>(undefined);

export function WalletDataProvider({ children }: { children: ReactNode }) {
  const { account, connected } = useAptosWallet();
  const [tokens, setTokens] = useState<PortfolioToken[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchWalletData = useCallback(async () => {
    if (!connected || !account) {
      setTokens([]);
      return;
    }

    try {
      setIsRefreshing(true);
      const portfolioService = new AptosPortfolioService();
      const { tokens: fetchedTokens } = await portfolioService.getPortfolio(account.address.toString());
      setTokens(fetchedTokens);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      setTokens([]);
    } finally {
      setIsRefreshing(false);
    }
  }, [connected, account]);

  const refreshPortfolio = useCallback(async () => {
    console.log('[WalletContext] Manual refresh triggered');
    await fetchWalletData();
  }, [fetchWalletData]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const walletData: WalletContextType = {
    address: account?.address.toString(),
    tokens,
    refreshPortfolio,
    isRefreshing,
  };

  return (
    <WalletDataContext.Provider value={walletData}>
      {children}
    </WalletDataContext.Provider>
  );
}

export function useWalletData() {
  const context = useContext(WalletDataContext);
  if (context === undefined) {
    throw new Error('useWalletData must be used within a WalletDataProvider');
  }
  return context;
} 