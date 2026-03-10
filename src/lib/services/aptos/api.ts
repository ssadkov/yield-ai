import { FungibleAssetBalance } from '@/lib/types/aptos';

export class AptosApiService {
  async getBalances(address: string) {
    try {
      // In browser use same origin (relative URL); on server use full URL
      const baseUrl =
        typeof window !== 'undefined'
          ? ''
          : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
      const response = await fetch(
        `${baseUrl}/api/aptos/walletBalance?address=${encodeURIComponent(address)}`
      );

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