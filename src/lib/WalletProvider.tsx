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
    
    // Global handler to suppress benign wallet adapter promise rejections
    // These errors are thrown internally by wallet adapters and can't be caught elsewhere
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const name = error?.name || '';
      const message = error?.message || String(error) || '';
      
      // List of benign wallet errors that should be suppressed
      const isBenignWalletError = 
        name === 'WalletNotConnectedError' ||
        name === 'WalletDisconnectedError' ||
        name === 'WalletNotSelectedError' ||
        message === 'Unexpected error' ||
        message.includes('WalletNotConnectedError') ||
        message.includes('WalletDisconnectedError') ||
        message.includes('WalletNotSelectedError') ||
        message.includes('User has rejected the request') ||
        message.includes('User rejected') ||
        message.includes('Unexpected error');
      
      if (isBenignWalletError) {
        console.log('[WalletProvider] Suppressing benign wallet error:', name || message);
        event.preventDefault(); // Prevent the error from showing in console as uncaught
      }
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
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
        const name = (error as { name?: string })?.name;
        
        // Debug log all errors
        console.log('[WalletProvider] onError called:', { name, message, error });
        
        // Don't show toast for expected user actions, auto-connect noise, or disconnect noise
        // WalletDisconnectedError / WalletNotConnectedError / WalletNotSelectedError могут лететь при ручном disconnect и не должны пугать пользователя.
        // Also suppress "Unexpected error" which Trust wallet throws on disconnect
        if (
          message === "Unexpected error" ||
          message === "User has rejected the request" ||
          name === "WalletDisconnectedError" ||
          name === "WalletNotConnectedError" ||
          name === "WalletNotSelectedError" ||
          (typeof message === "string" && (
            message.includes("WalletDisconnectedError") || 
            message.includes("WalletNotConnectedError") || 
            message.includes("WalletNotSelectedError") ||
            message.includes("disconnect") ||
            message.includes("Disconnect") ||
            message.includes("already connected")
          ))
        ) {
          console.log('[WalletProvider] Suppressing error:', name || message);
          return;
        }
        console.error("Wallet error:", error);
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