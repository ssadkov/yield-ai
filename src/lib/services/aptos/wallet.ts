import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { http } from '@/lib/utils/http';

interface FungibleAssetBalance {
  asset_type: string;
  amount: string;
  last_transaction_timestamp: string;
}

export class AptosWalletService {
  private aptos: Aptos;
  private baseUrl: string;

  constructor() {
    const config = new AptosConfig({
      network: (process.env.APTOS_NETWORK as Network) || Network.MAINNET,
    });
    this.aptos = new Aptos(config);
    this.baseUrl = 'https://indexer.mainnet.aptoslabs.com/v1/graphql';
  }

  async getBalances(address: string) {
    try {
      const query = `
        query GetAccountBalances($address: String!) {
          current_fungible_asset_balances(
            where: {owner_address: {_eq: $address}, amount: {_gt: "0"}}
          ) {
            asset_type
            amount
            last_transaction_timestamp
          }
        }
      `;

      const response = await http.post<{
        data: {
          current_fungible_asset_balances: FungibleAssetBalance[];
        };
      }>(this.baseUrl, {
        query,
        variables: { address },
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.APTOS_API_KEY}`,
        }
      });

      return {
        balances: response.data.current_fungible_asset_balances
      };
    } catch (error) {
      console.error('Failed to fetch Aptos balances:', error);
      throw error;
    }
  }
} 