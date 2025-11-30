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
  // For native Aptos wallets: GasStationTransactionSubmitter can be used globally OR passed per transaction
  // According to documentation, transactionSubmitter in transactionInput overrides global one
  // Note: We don't use global transactionSubmitter in dappConfig to avoid conflicts
  // Gas Station will be used explicitly in transactionInput for both x-chain and native Aptos wallets
  const gasStationService = GasStationService.getInstance();
  
  if (gasStationService.isAvailable()) {
    const gasStationTransactionSubmitter = gasStationService.getTransactionSubmitter();
    if (gasStationTransactionSubmitter) {
      console.log('[gas-station] WalletProvider: Gas Station available:', {
        type: gasStationTransactionSubmitter.constructor?.name,
        available: Boolean(gasStationTransactionSubmitter)
      });
    }
  } else {
    console.warn('[gas-station] WalletProvider: Gas Station is not available');
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
        // Set transactionSubmitter to undefined to avoid conflicts with explicit transactionSubmitter in transactionInput
        // Gas Station will be used explicitly in transactionInput for both x-chain and native Aptos wallets
        transactionSubmitter: undefined, // Explicitly set to undefined to avoid conflicts
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
        console.error('Wallet error:', error);
        toast({
          variant: "destructive",
          title: "Wallet Error",
          description: error || "Unknown wallet error",
        });
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}; 