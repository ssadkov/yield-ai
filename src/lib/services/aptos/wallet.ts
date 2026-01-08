import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { http } from '@/lib/utils/http';
import { AptosApiService } from './api';

interface FungibleAssetBalance {
  asset_type: string;
  amount: string;
  last_transaction_timestamp: string;
}

export class AptosWalletService {
  private static instance: AptosWalletService;
  private aptos: Aptos;
  private baseUrl: string;

  private constructor() {
    const APTOS_API_KEY = process.env.APTOS_API_KEY;
    const config = new AptosConfig({
      network: (process.env.APTOS_NETWORK as Network) || Network.MAINNET,
      ...(APTOS_API_KEY && {
        clientConfig: {
          HEADERS: {
            'Authorization': `Bearer ${APTOS_API_KEY}`,
          },
        },
      }),
    });
    this.aptos = new Aptos(config);
    this.baseUrl = 'https://indexer.mainnet.aptoslabs.com/v1/graphql';
  }

  public static getInstance(): AptosWalletService {
    if (!AptosWalletService.instance) {
      AptosWalletService.instance = new AptosWalletService();
    }
    return AptosWalletService.instance;
  }

  async getBalances(address: string) {
    try {
      // Use AptosApiService directly instead of making HTTP request
      const apiService = new AptosApiService();
      const data = await apiService.getBalances(address);
      
      return data;
    } catch (error) {
      console.error('Failed to fetch Aptos balances:', error);
      return { balances: [] };
    }
  }

  async connect(): Promise<string> {
    try {
      const response = await fetch('/api/aptos/connect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to connect wallet');
      }

      const data = await response.json();
      return data.address;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    }
  }
} 