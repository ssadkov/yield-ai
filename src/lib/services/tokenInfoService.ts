import { normalizeAddress } from '@/lib/utils/addressNormalization';

/**
 * Token Info with all available data
 */
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: number | null;
  logoUrl: string | null;
  source: 'tokenList' | 'echelon' | 'panora' | 'unknown';
  // Optional protocol-specific fields
  market?: string;
  supplyCap?: number;
  borrowCap?: number;
  supplyApr?: number;
  borrowApr?: number;
  // For compatibility with existing code
  tokenAddress?: string | null;
  faAddress?: string;
  isFungible?: boolean;
}

interface CacheEntry {
  data: TokenInfo;
  timestamp: number;
}

/**
 * Token Info Service with caching and protocol API fallbacks
 * 
 * Lookup priority:
 * 1. Memory cache (5 min TTL)
 * 2. API endpoint (which checks: tokenList → Echelon → Panora)
 */
export class TokenInfoService {
  private static instance: TokenInfoService;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): TokenInfoService {
    if (!TokenInfoService.instance) {
      TokenInfoService.instance = new TokenInfoService();
    }
    return TokenInfoService.instance;
  }

  /**
   * Get token info with fallback to protocol APIs
   * @param address Token address (will be normalized)
   * @param useCache Whether to use cache (default: true)
   */
  async getTokenInfo(address: string, useCache = true): Promise<TokenInfo | null> {
    const normalizedAddress = normalizeAddress(address);

    // Check cache first
    if (useCache) {
      const cached = this.cache.get(normalizedAddress);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log('[TokenInfoService] Cache hit for:', normalizedAddress);
        return cached.data;
      }
    }

    // Fetch from API
    try {
      // Determine base URL (server-side needs full URL)
      const baseUrl = typeof window === 'undefined' 
        ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
        : '';
      const apiUrl = `${baseUrl}/api/tokens/info?address=${encodeURIComponent(address)}`;
      
      const response = await fetch(apiUrl);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const tokenInfo = result.data as TokenInfo;
          
          // Add compatibility fields
          tokenInfo.tokenAddress = tokenInfo.address.includes('::') ? tokenInfo.address : null;
          tokenInfo.faAddress = !tokenInfo.address.includes('::') ? tokenInfo.address : undefined;
          tokenInfo.isFungible = !tokenInfo.address.includes('::');
          
          // Cache the result
          this.cache.set(normalizedAddress, {
            data: tokenInfo,
            timestamp: Date.now()
          });
          
          console.log('[TokenInfoService] Found token:', tokenInfo.symbol, 'from', tokenInfo.source);
          return tokenInfo;
        }
      }
      
      // Token not found
      console.log('[TokenInfoService] Token not found:', normalizedAddress);
      return null;
    } catch (error) {
      console.error('[TokenInfoService] Error fetching token info:', error);
      return null;
    }
  }

  /**
   * Get multiple token infos in batch
   * @param addresses Array of token addresses
   */
  async getTokenInfoBatch(addresses: string[]): Promise<Map<string, TokenInfo>> {
    const results = new Map<string, TokenInfo>();
    
    // Process in parallel
    await Promise.all(
      addresses.map(async (address) => {
        const info = await this.getTokenInfo(address);
        if (info) {
          const normalized = normalizeAddress(address);
          results.set(normalized, info);
          // Also set under original address
          results.set(address, info);
        }
      })
    );
    
    return results;
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[TokenInfoService] Cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}
