import { GasStationClient, createGasStationClient } from "@aptos-labs/gas-station-client";
import { Network, AptosConfig } from "@aptos-labs/ts-sdk";

export class GasStationService {
  private static instance: GasStationService;
  private gasStationClient: GasStationClient | null = null;

  private constructor() {
    this.initializeGasStationClient();
  }

  public static getInstance(): GasStationService {
    if (!GasStationService.instance) {
      GasStationService.instance = new GasStationService();
    }
    return GasStationService.instance;
  }

  private initializeGasStationClient() {
    try {
      // Check if we're on the client side
      if (typeof window === 'undefined') {
        return;
      }

      const apiKey = process.env.NEXT_PUBLIC_APTOS_GAS_STATION_KEY;
      
      if (!apiKey) {
        console.warn('NEXT_PUBLIC_APTOS_GAS_STATION_KEY not found, gas station will not be available');
        return;
      }

      
      this.gasStationClient = createGasStationClient({
        network: Network.MAINNET,
        apiKey: apiKey,
      });

    } catch (error) {
      console.error('Failed to initialize gas station client:', error);
      this.gasStationClient = null;
    }
  }

  public getGasStationClient(): GasStationClient | null {
    return this.gasStationClient;
  }

  public isAvailable(): boolean {
    return this.gasStationClient !== null;
  }
} 