import { useState } from 'react';
import { AptosWalletAdapter } from '@/lib/adapters/aptos';
import { useWalletStore } from '@/lib/stores/wallet';
import { usePortfolioStore } from '@/lib/stores/portfolio';

export function WalletConnectButton() {
  const { setWallet, setAddress } = useWalletStore();
  const { setPortfolio } = usePortfolioStore();

  const handleConnect = async () => {
    try {
      const wallet = new AptosWalletAdapter();
      await wallet.connect();
      const account = await wallet.account();
      
      if (account) {
        setWallet(wallet);
        setAddress(account.address);
        
        // Получаем портфолио через API
        const response = await fetch(`/api/aptos/portfolio?address=${account.address}`);
        if (!response.ok) {
          throw new Error('Failed to fetch portfolio');
        }
        const data = await response.json();
        setPortfolio(data.data);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  return (
    <button
      onClick={handleConnect}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Connect Wallet
    </button>
  );
} 