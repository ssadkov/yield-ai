export class AptBalanceService {
  static async getAptBalance(address: string): Promise<number> {
    try {

      // Use our new API endpoint that doesn't require API keys
      const response = await fetch(`/api/aptos/aptBalance?address=${address}`);
      
      if (!response.ok) {
        console.error('Failed to fetch APT balance:', response.status);
        // In case of error, assume user has APT to be safe
        return 1;
      }

      const data = await response.json();
      
      if (data.error) {
        console.error('API error:', data.error);
        return 1;
      }

      const aptBalance = data.aptBalance || 0;

      return aptBalance;
    } catch (error) {
      console.error('Error checking APT balance:', error);
      // In case of error, assume user has APT to be safe
      return 1; // Return 1 APT as fallback to use regular transaction
    }
  }
} 