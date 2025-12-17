"use client";

import { useMemo } from 'react';
import WormholeConnect, {
  DEFAULT_ROUTES,
  type config,
} from '@wormhole-foundation/wormhole-connect';

export default function BridgePage() {
  // Configure Wormhole Connect for Solana → Aptos USDC bridging
  // Using DEFAULT_ROUTES which includes both automatic and manual CCTP
  const wormholeConfig: config.WormholeConnectConfig = useMemo(() => ({
    network: 'Mainnet',
    chains: ['Solana', 'Aptos'],
    // Use default routes (includes both automatic and manual CCTP)
    routes: DEFAULT_ROUTES,
    // RPC endpoints with fallbacks
    // Priority: env vars > Helius RPC > official public endpoints
    rpcs: {
      Solana: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
              process.env.SOLANA_RPC_URL || 
              'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234', // Helius RPC with API key
      Aptos: process.env.NEXT_PUBLIC_APTOS_RPC_URL || 
             process.env.APTOS_RPC_URL || 
             'https://fullnode.mainnet.aptoslabs.com', // Official public endpoint (no API key required)
    },
  }), []);

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="w-full flex-1 min-h-0">
        <WormholeConnect config={wormholeConfig} />
      </div>
    </div>
  );
}

