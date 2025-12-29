"use client";

import { useMemo } from 'react';
import WormholeConnect, {
  DEFAULT_ROUTES,
  type config,
} from '@wormhole-foundation/wormhole-connect';
// NOTE: Mayan routes do NOT support Solana → Aptos route
// Mayan API returns 406 (Not Acceptable) for this route pair
// Even MayanRouteSWIFT (SWIFT protocol) returns 406
// Therefore, we're using only DEFAULT_ROUTES which includes AutomaticCCTPRoute
// However, AutomaticCCTPRoute may not support gas drop for Solana → Aptos

export default function BridgePage() {
  // Configure Wormhole Connect for Solana → Aptos USDC bridging
  // Using DEFAULT_ROUTES which includes AutomaticCCTPRoute
  // 
  // IMPORTANT: Mayan Finance does NOT support Solana → Aptos route
  // All Mayan routes (MayanRoute, MayanRouteSWIFT, MayanRouteMCTP, etc.) 
  // return 406 (Not Acceptable) from their API for this route pair
  //
  // For gas payment on empty Aptos wallets, consider:
  // 1. Using Aptos Gas Station (already integrated in your project via WalletProvider)
  // 2. Pre-funding destination wallets with minimal APT (~0.01 APT)
  // 3. Using alternative bridge solutions that support this route with gas drop
  // 4. Contact Mayan Finance to request Solana → Aptos support
  const wormholeConfig: config.WormholeConnectConfig = useMemo(() => {
    const routes = [
      ...DEFAULT_ROUTES,
      // Mayan routes removed - they don't support Solana → Aptos
    ];
    
    // Debug: log routes configuration
    if (typeof window !== 'undefined') {
      console.log('[Bridge] Configured routes:', routes.map(r => r?.meta?.name || r?.name || 'Unknown'));
    }
    
    return {
      network: 'Mainnet' as const,
      chains: ['Solana', 'Aptos'] as const,
      routes,
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
    };
  }, []);

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="w-full flex-1 min-h-0">
        <WormholeConnect config={wormholeConfig} />
      </div>
    </div>
  );
}

