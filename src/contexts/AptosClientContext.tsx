'use client';

import { createContext, useContext, useMemo, ReactNode } from "react";
import { Aptos, AptosConfig, Network, Account } from "@aptos-labs/ts-sdk";
import { GasStationService } from "@/lib/services/gasStation";

const AptosClientContext = createContext<Aptos | null>(null);

export function AptosClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    const gasStationService = GasStationService.getInstance();
    const transactionSubmitter = gasStationService.getGasStationClient() ?? undefined;

    const config = new AptosConfig({
      network: Network.MAINNET,
      ...(transactionSubmitter && { transactionSubmitter }),
    });

    return new Aptos(config);
  }, []);

  return <AptosClientContext.Provider value={client}>{children}</AptosClientContext.Provider>;
}

export function useAptosClient() {
  const client = useContext(AptosClientContext);
  if (!client) {
    throw new Error("useAptosClient must be used within an AptosClientProvider");
  }
  return client;
}

