"use client";

import { WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import { 
  PhantomWalletAdapter,
  TrustWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { useMemo, ReactNode } from 'react';

// RPC endpoint for Solana
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
                   process.env.SOLANA_RPC_URL || 
                   'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234';

export function SolanaWalletProviderWrapper({ children }: { children: ReactNode }) {
  // Create array of wallet adapters
  const wallets = useMemo(() => {
    return [
      new PhantomWalletAdapter(),
      new TrustWalletAdapter(),
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

