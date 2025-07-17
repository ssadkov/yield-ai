"use client";

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { PropsWithChildren } from "react";
import { Network, Aptos, AptosConfig } from "@aptos-labs/ts-sdk";
import { useToast } from "@/components/ui/use-toast";

let dappImageURI: string | undefined;
if (typeof window !== "undefined") {
  dappImageURI = `${window.location.origin}${window.location.pathname}favicon.ico`;
}

export const WalletProvider = ({ children }: PropsWithChildren) => {
  const { toast } = useToast();

  // Create Aptos config without gas station - it will be configured dynamically
  const aptosConfig = new AptosConfig({
    network: Network.MAINNET,
  });

  const aptos = new Aptos(aptosConfig);

  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{
        network: Network.MAINNET,
        transactionSubmitter: aptos.config.getTransactionSubmitter(),
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
        toast({
          variant: "destructive",
          title: "Error",
          description: error || "Unknown wallet error",
        });
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}; 