import { GasStationClient, GasStationTransactionSubmitter } from "@aptos-labs/gas-station-client";
import { Network, AptosConfig } from "@aptos-labs/ts-sdk";
import type { TransactionSubmitter, PendingTransactionResponse } from "@aptos-labs/ts-sdk";

/** Aptos chain IDs: mainnet=1, testnet=2 */
const CHAIN_ID_MAINNET = 1;
const CHAIN_ID_TESTNET = 2;

function isTestnetFromArgs(args: {
  aptosConfig?: AptosConfig | null;
  transaction?: { rawTransaction?: unknown } | null;
}): boolean {
  const cfg = args?.aptosConfig as { network?: Network } | undefined;
  if (cfg?.network === Network.TESTNET) return true;

  const raw = args?.transaction?.rawTransaction as { chain_id?: number; chainId?: number } | undefined;
  const chainId = raw?.chain_id ?? raw?.chainId;
  if (typeof chainId === "number" && chainId === CHAIN_ID_TESTNET) return true;
  return false;
}

/**
 * Delegating submitter: routes to mainnet or testnet Gas Station based on transaction network.
 */
class DelegatingGasStationSubmitter implements TransactionSubmitter {
  constructor(
    private mainnetSubmitter: GasStationTransactionSubmitter | null,
    private testnetSubmitter: GasStationTransactionSubmitter | null
  ) {}

  async submitTransaction(
    args: Parameters<TransactionSubmitter["submitTransaction"]>[0]
  ): Promise<PendingTransactionResponse> {
    const useTestnet = isTestnetFromArgs(args);
    const submitter = useTestnet ? this.testnetSubmitter : this.mainnetSubmitter;

    if (!submitter) {
      const net = useTestnet ? "testnet" : "mainnet";
      throw new Error(`Gas Station not available for ${net}. Configure NEXT_PUBLIC_APTOS_GAS_STATION_KEY${useTestnet ? "_TESTNET" : ""}.`);
    }

    console.log("[gas-station] Routing to", useTestnet ? "testnet" : "mainnet", "Gas Station");
    return submitter.submitTransaction(args);
  }
}

export class GasStationService {
  private static instance: GasStationService;
  private mainnetClient: GasStationClient | null = null;
  private testnetClient: GasStationClient | null = null;
  private mainnetSubmitter: GasStationTransactionSubmitter | null = null;
  private testnetSubmitter: GasStationTransactionSubmitter | null = null;
  private delegatingSubmitter: DelegatingGasStationSubmitter | null = null;

  private constructor() {
    this.initializeGasStationClients();
  }

  public static getInstance(): GasStationService {
    if (!GasStationService.instance) {
      GasStationService.instance = new GasStationService();
    }
    return GasStationService.instance;
  }

  private initializeGasStationClients() {
    try {
      if (typeof window === "undefined") return;

      const mainnetKey = process.env.NEXT_PUBLIC_APTOS_GAS_STATION_KEY?.trim();
      const testnetKey = process.env.NEXT_PUBLIC_APTOS_GAS_STATION_KEY_TESTNET?.trim();

      if (mainnetKey) {
        this.mainnetClient = new GasStationClient({
          network: Network.MAINNET,
          apiKey: mainnetKey,
        });
        this.mainnetSubmitter = new GasStationTransactionSubmitter(this.mainnetClient);
      } else {
        console.warn("NEXT_PUBLIC_APTOS_GAS_STATION_KEY not found");
      }

      if (testnetKey) {
        this.testnetClient = new GasStationClient({
          network: Network.TESTNET,
          apiKey: testnetKey,
        });
        this.testnetSubmitter = new GasStationTransactionSubmitter(this.testnetClient);
      } else {
        console.warn("NEXT_PUBLIC_APTOS_GAS_STATION_KEY_TESTNET not found (testnet Gas Station disabled)");
      }

      if (this.mainnetSubmitter || this.testnetSubmitter) {
        this.delegatingSubmitter = new DelegatingGasStationSubmitter(
          this.mainnetSubmitter,
          this.testnetSubmitter
        );
      }
    } catch (error) {
      console.error("Failed to initialize gas station clients:", error);
      this.mainnetClient = null;
      this.testnetClient = null;
      this.mainnetSubmitter = null;
      this.testnetSubmitter = null;
      this.delegatingSubmitter = null;
    }
  }

  public getGasStationClient(network?: Network): GasStationClient | null {
    if (network === Network.TESTNET) return this.testnetClient;
    return this.mainnetClient;
  }

  public getTransactionSubmitter(): DelegatingGasStationSubmitter | null {
    return this.delegatingSubmitter;
  }

  public isAvailable(): boolean {
    return this.delegatingSubmitter !== null;
  }
} 