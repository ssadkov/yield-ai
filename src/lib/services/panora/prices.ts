import { TokenPrice } from '@/lib/types/panora';

export class PanoraPricesService {
  private static instance: PanoraPricesService;

  private constructor() {}

  static getInstance(): PanoraPricesService {
    if (!PanoraPricesService.instance) {
      PanoraPricesService.instance = new PanoraPricesService();
    }
    return PanoraPricesService.instance;
  }

  async getPrices(chainId: number, addresses?: string[]) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('chainId', chainId.toString());
      if (addresses?.length) {
        queryParams.append('tokenAddress', addresses.join(','));
      }

      // На сервере используем полный URL
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/panora/tokenPrices?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch prices:', error);
      return { data: [] };
    }
  }
} 