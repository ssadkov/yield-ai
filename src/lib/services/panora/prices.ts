import { TokenPrice } from '@/lib/types/panora';

interface CachedPrices {
  data: TokenPrice[];
  timestamp: number;
}

export class PanoraPricesService {
  private static instance: PanoraPricesService;
  private cache: Map<string, CachedPrices> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 минут

  private constructor() {}

  static getInstance(): PanoraPricesService {
    if (!PanoraPricesService.instance) {
      PanoraPricesService.instance = new PanoraPricesService();
    }
    return PanoraPricesService.instance;
  }

  private getCacheKey(chainId: number, addresses?: string[]): string {
    return `${chainId}:${addresses?.sort().join(',') || 'all'}`;
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_TTL;
  }

  clearCache(): void {
    this.cache.clear();
  }

  async getPrices(chainId: number, addresses?: string[]) {
    try {
      const cacheKey = this.getCacheKey(chainId, addresses);
      const cached = this.cache.get(cacheKey);

      if (cached && this.isCacheValid(cached.timestamp)) {
        const age = Math.round((Date.now() - cached.timestamp) / 1000);
        return cached.data;
      }


      const queryParams = new URLSearchParams();
      queryParams.append('chainId', chainId.toString());
      if (addresses?.length) {
        queryParams.append('tokenAddress', addresses.join(','));
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!baseUrl) {
        throw new Error('NEXT_PUBLIC_API_URL is not set');
      }

      const response = await fetch(`${baseUrl}/api/panora/tokenPrices?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }

      const data = await response.json();
      console.log('Panora API response:', data);
      
      // Cache result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error('Failed to fetch prices:', error);
      return { data: [] };
    }
  }
} 