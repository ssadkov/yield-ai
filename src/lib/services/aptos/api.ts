import { http } from '@/lib/utils/http';
import { FungibleAssetBalance } from '@/lib/types/aptos';

export class AptosApiService {
  private baseUrl = 'https://indexer.mainnet.aptoslabs.com/v1/graphql';

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

      if (!response.data) {
        throw new Error('No data received from API');
      }

      return {
        balances: response.data.current_fungible_asset_balances || []
      };
    } catch (error) {
      console.error('Failed to fetch Aptos balances:', error);
      return { balances: [] };
    }
  }
} 