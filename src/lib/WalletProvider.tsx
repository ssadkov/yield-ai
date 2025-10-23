"use client";

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { PropsWithChildren, useState, useEffect } from "react";
import { Network, Aptos, AptosConfig } from "@aptos-labs/ts-sdk";
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
  }, []);

  // Initialize gas station globally (this was the working version)
  const gasStationService = GasStationService.getInstance();
  let transactionSubmitter;
  
  if (gasStationService.isAvailable()) {
    // Use gas station as transaction submitter
    const gasStationClient = gasStationService.getGasStationClient();
    if (gasStationClient) {
      transactionSubmitter = gasStationClient;
    }
  }

  // Create Aptos config with gas station if available
  const aptosConfig = new AptosConfig({
    network: Network.MAINNET,
    ...(transactionSubmitter && { transactionSubmitter }),
  });

  const aptos = new Aptos(aptosConfig);

  // Don't render wallet provider until client-side
  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{
        network: Network.MAINNET,
        transactionSubmitter: transactionSubmitter || aptos.config.getTransactionSubmitter(),
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