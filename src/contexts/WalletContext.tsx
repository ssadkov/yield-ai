'use client';

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
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
}

const WalletDataContext = createContext<WalletContextType | undefined>(undefined);

export function WalletDataProvider({ children }: { children: ReactNode }) {
  const { account, connected } = useAptosWallet();
  const [walletData, setWalletData] = useState<WalletContextType>({
    address: undefined,
    tokens: [],
  });

  useEffect(() => {
    if (connected && account) {
      const fetchWalletData = async () => {
        try {
          const portfolioService = new AptosPortfolioService();
          const { tokens } = await portfolioService.getPortfolio(account.address.toString());

          setWalletData({
            address: account.address.toString(),
            tokens
          });
        } catch (error) {
          console.error('Error fetching wallet data:', error);
          setWalletData({
            address: account.address.toString(),
            tokens: []
          });
        }
      };

      fetchWalletData();
    } else {
      setWalletData({
        address: undefined,
        tokens: []
      });
    }
  }, [connected, account]);

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