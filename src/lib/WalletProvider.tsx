"use client";

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { setupAutomaticSolanaWalletDerivation } from "@aptos-labs/derived-wallet-solana";
import { PropsWithChildren, useState, useEffect } from "react";
import { Network } from "@aptos-labs/ts-sdk";
import { useToast } from "@/components/ui/use-toast";
import { GasStationService } from "./services/gasStation";

let dappImageURI: string | undefined;
if (typeof window !== "undefined") {
  dappImageURI = `${window.location.origin}${window.location.pathname}favicon.ico`;
}

export const WalletProvider = ({ children }: PropsWithChildren) => {
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setupAutomaticSolanaWalletDerivation({
      defaultNetwork: Network.MAINNET,
    });
  }, []);

  // Initialize gas station
  // For x-chain accounts: GasStationTransactionSubmitter is passed in transactionInput (per transaction)
  //   This overrides the global transactionSubmitter, so x-chain wallets will use Gas Station explicitly
  // For native Aptos wallets: GasStationTransactionSubmitter is set globally in dappConfig
  //   All transactions via signAndSubmitTransaction will automatically use Gas Station (free transactions)
  // According to documentation, transactionSubmitter in transactionInput overrides global one
  const gasStationService = GasStationService.getInstance();
  const gasStationTransactionSubmitter = gasStationService.isAvailable() 
    ? gasStationService.getTransactionSubmitter() 
    : undefined;
  
  if (gasStationTransactionSubmitter) {
    console.log('[gas-station] WalletProvider: Gas Station available globally:', {
      type: gasStationTransactionSubmitter.constructor?.name,
      available: Boolean(gasStationTransactionSubmitter)
    });
  } else {
    console.warn('[gas-station] WalletProvider: Gas Station is not available - native Aptos wallets will pay gas fees');
  }

  // Don't render wallet provider until client-side
  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{
        network: Network.MAINNET,
        crossChainWallets: true,
        // Set global transactionSubmitter for native Aptos wallets
        // X-chain wallets will override this with explicit transactionSubmitter in transactionInput
        transactionSubmitter: gasStationTransactionSubmitter || undefined,
        aptosApiKeys: {
          testnet: process.env.NEXT_PUBLIC_APTOS_API_KEY_TESTNET,
          devnet: process.env.NEXT_PUBLIC_APTOS_API_KEY_DEVNET,
        },
        aptosConnect: {
          dappId: "57fa42a9-29c6-4f1e-939c-4eefa36d9ff5",
          dappImageURI,
        },
        mizuwallet: {
          manifestURL:
            "https://assets.mz.xyz/static/config/mizuwallet-connect-manifest.json",
        },
      }}
      onError={(error) => {
        const message = typeof error === "string" ? error : (error?.message ?? "Unknown wallet error");
        console.error("Wallet error:", error);
        // Don't show toast for expected user actions or auto-connect noise
        if (message === "Unexpected error" || message === "User has rejected the request") {
          return;
        }
        toast({
          variant: "destructive",
          title: "Wallet Error",
          description: message,
        });
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}; 