"use client";

import { WalletProvider as SolanaWalletProvider, ConnectionProvider } from "@solana/wallet-adapter-react";
import {
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from "@solana-mobile/wallet-standard-mobile";
import { useMemo, useEffect, type ReactNode } from "react";

const WALLET_NAME_KEY = "walletName";

/** Normalize walletName to valid JSON so adapter's JSON.parse() does not throw (e.g. "Trust" → "\"Trust\""). */
function normalizeWalletNameStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(WALLET_NAME_KEY);
    if (raw == null || raw === "") return;
    JSON.parse(raw);
  } catch {
    const raw = window.localStorage.getItem(WALLET_NAME_KEY);
    if (raw != null && raw !== "") {
      window.localStorage.setItem(WALLET_NAME_KEY, JSON.stringify(raw));
    }
  }
}

export function SolanaProvider({ children }: { children: ReactNode }) {
  normalizeWalletNameStorage();

  const endpoint = useMemo(
    () =>
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      process.env.SOLANA_RPC_URL ||
      (process.env.NEXT_PUBLIC_SOLANA_RPC_API_KEY || process.env.SOLANA_RPC_API_KEY
        ? `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_SOLANA_RPC_API_KEY || process.env.SOLANA_RPC_API_KEY}`
        : "https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234"),
    []
  );
  
  // Most wallets (Phantom, Trust, OKX) register themselves as Standard Wallets automatically.
  // We only include wallets that don't auto-register to avoid conflicts.
  const wallets = useMemo(
    () => [
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    []
  );

  // Register Mobile Wallet Adapter so "Mobile Wallet" appears in Solana wallet picker on Android Chrome (e.g. Seeker).
  useEffect(() => {
    registerMwa({
      appIdentity: {
        name: "Yield AI",
        uri: typeof window !== "undefined" ? window.location.origin : "https://yieldai.io",
        icon: "/icon.png",
      },
      authorizationCache: createDefaultAuthorizationCache(),
      chains: ["solana:mainnet"],
      chainSelector: createDefaultChainSelector(),
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    });
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider 
        wallets={wallets} 
        autoConnect 
        localStorageKey="walletName"
        onError={(error) => {
          const name = (error as { name?: string })?.name;
          // Suppress expected errors during disconnect/reconnect flows
          if (
            name === "WalletDisconnectedError" ||
            name === "WalletNotConnectedError" ||
            name === "WalletNotSelectedError"
          ) {
            return;
          }
          // Try to get the wallet name for a helpful hint
          let walletHint = '';
          try {
            const raw = window.localStorage.getItem("walletName");
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed) walletHint = ` (wallet: ${parsed})`;
            }
          } catch {}
          console.error(`Solana wallet error${walletHint}: Please check that your wallet extension is unlocked and not redirecting to an external page.`, error);
        }}
      >
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
