export class AptBalanceService {
  static async getAptBalance(address: string): Promise<number> {
    try {

      // Use our new API endpoint that doesn't require API keys
      const response = await fetch(`/api/aptos/aptBalance?address=${address}`);
      
      if (!response.ok) {
      console.error('Failed to fetch APT balance:', response.status);
      return 0;
      }

      const data = await response.json();
      
      if (data.error) {
        console.error('API error:', data.error);
        return 0;
      }

      const aptBalance = data.aptBalance || 0;

      return aptBalance;
    } catch (error) {
      console.error('Error checking APT balance:', error);
      return 0;
    }
  }
} 