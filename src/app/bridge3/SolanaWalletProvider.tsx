"use client";

import { WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { CoinbaseWalletAdapter } from '@solana/wallet-adapter-coinbase';
import { TorusWalletAdapter } from '@solana/wallet-adapter-torus';
import { LedgerWalletAdapter } from '@solana/wallet-adapter-ledger';
import { useMemo, ReactNode } from 'react';

// RPC endpoint for Solana
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
                 process.env.SOLANA_RPC_URL ||
                 (process.env.NEXT_PUBLIC_SOLANA_RPC_API_KEY || process.env.SOLANA_RPC_API_KEY
                   ? `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_SOLANA_RPC_API_KEY || process.env.SOLANA_RPC_API_KEY}`
                   : 'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234');

export function SolanaWalletProviderWrapper({ children }: { children: ReactNode }) {
  // Create array of wallet adapters
  // Note: Phantom and Trust are now Standard Wallets and are automatically detected
  // via @wallet-standard/core, so we don't need to include their adapters explicitly
  const wallets = useMemo(() => {
    return [
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ];
  }, []);

  // Create connection
  const endpoint = useMemo(() => SOLANA_RPC, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

