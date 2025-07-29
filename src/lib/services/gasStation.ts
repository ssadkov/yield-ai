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
        console.log('Gas station client initialization skipped on server side');
        return;
      }

      // Логируем все важные переменные
      console.log('NEXT_PUBLIC_APTOS_GAS_STATION_KEY:', process.env.NEXT_PUBLIC_APTOS_GAS_STATION_KEY);
      console.log('APTOS_GAS_STATION_API_KEY:', process.env.APTOS_GAS_STATION_API_KEY);
      console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
      console.log('NEXT_PUBLIC_SPONSOR_PRIVATE_KEY:', process.env.NEXT_PUBLIC_SPONSOR_PRIVATE_KEY);
      console.log('APTOS_API_KEY:', process.env.APTOS_API_KEY);
      console.log('APTOS_NETWORK:', process.env.APTOS_NETWORK);

      const apiKey = process.env.NEXT_PUBLIC_APTOS_GAS_STATION_KEY;
      
      if (!apiKey) {
        console.warn('NEXT_PUBLIC_APTOS_GAS_STATION_KEY not found, gas station will not be available');
        return;
      }

      console.log('Initializing gas station client...');
      
      this.gasStationClient = createGasStationClient({
        network: Network.MAINNET,
        apiKey: apiKey,
      });

      console.log('Gas station client initialized successfully');
      console.log('Gas station client config:', {
        network: Network.MAINNET,
        apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'undefined'
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