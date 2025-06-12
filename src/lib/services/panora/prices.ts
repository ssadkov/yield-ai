import { PriceResponse, PriceError, TokenPrice, SupportedChainId, DEFAULT_CHAIN_ID } from '../../types/panora';
import { http } from '../../utils/http';

export class PanoraPricesService {
  private static instance: PanoraPricesService;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private cache: Map<string, { data: TokenPrice[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute

  private constructor() {
    this.baseUrl = process.env.PANORA_API_URL || 'https://api.panora.exchange';
    this.apiKey = process.env.PANORA_API_KEY || '';
  }

  public static getInstance(): PanoraPricesService {
    if (!PanoraPricesService.instance) {
      PanoraPricesService.instance = new PanoraPricesService();
    }
    return PanoraPricesService.instance;
  }

  private getCacheKey(chainId: SupportedChainId, tokenAddresses?: string[]): string {
    return tokenAddresses ? `${chainId}:${tokenAddresses.join(',')}` : `${chainId}:all`;
  }

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.CACHE_TTL;
  }

  public async getPrices(chainId: SupportedChainId = DEFAULT_CHAIN_ID, tokenAddresses?: string[]): Promise<PriceResponse> {
    try {
      const cacheKey = this.getCacheKey(chainId, tokenAddresses);
      
      if (this.isCacheValid(cacheKey)) {
        return {
          data: this.cache.get(cacheKey)!.data,
          status: 200
        };
      }

      const queryParams = new URLSearchParams();
      if (tokenAddresses?.length) {
        queryParams.append('tokenAddress', tokenAddresses.join(','));
      }
      queryParams.append('chainId', chainId.toString());

      const response = await http.get(`${this.baseUrl}/prices?${queryParams.toString()}`, {
        headers: {
          'x-api-key': this.apiKey
        }
      });

      const data = response as TokenPrice[];
      
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return {
        data,
        status: 200
      };
    } catch (error) {
      throw new PriceError('Failed to fetch prices');
    }
  }
} 