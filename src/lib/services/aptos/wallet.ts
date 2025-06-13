import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { http } from '@/lib/utils/http';

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
    const config = new AptosConfig({
      network: (process.env.APTOS_NETWORK as Network) || Network.MAINNET,
    });
    this.aptos = new Aptos(config);
    this.baseUrl = 'https://indexer.mainnet.aptoslabs.com/v1/graphql';
    console.log('AptosWalletService initialized with baseUrl:', this.baseUrl);
  }

  public static getInstance(): AptosWalletService {
    if (!AptosWalletService.instance) {
      AptosWalletService.instance = new AptosWalletService();
    }
    return AptosWalletService.instance;
  }

  async getBalances(address: string) {
    try {
      console.log('Getting balances for address:', address);
      const response = await fetch('/api/aptos/balances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch balances');
      }

      const data = await response.json();
      console.log('Balances response:', data);

      if (!data.data?.current_fungible_asset_balances) {
        return { balances: [] };
      }

      return {
        balances: data.data.current_fungible_asset_balances
      };
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