import { FungibleAssetBalance } from '@/lib/types/aptos';

export class AptosApiService {
  async getBalances(address: string) {
    try {
      // Use our server API endpoint instead of direct Aptos API call
      const response = await fetch(`/api/aptos/walletBalance?address=${address}`);
      
      if (!response.ok) {
        console.error('Failed to fetch balances from server API:', response.status);
        return { balances: [] };
      }

      const data = await response.json();

      if (data.error) {
        console.error('Server API error:', data.error);
        return { balances: [] };
      }

      return data.data || { balances: [] };
    } catch (error) {
      console.error('Failed to fetch Aptos balances:', error);
      return { balances: [] };
    }
  }
} 