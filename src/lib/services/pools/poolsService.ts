import { InvestmentData } from '@/types/investments';
import { poolSources } from '@/lib/config/poolsConfig';

export interface PoolSource {
  name: string;
  url: string;
  enabled: boolean;
  transform?: (data: any) => InvestmentData[];
}

export class PoolsService {
  private sources: PoolSource[] = poolSources;

  async getAllPools(): Promise<InvestmentData[]> {
    const allPools: InvestmentData[] = [];

    for (const source of this.sources) {
      if (!source.enabled) continue;

      try {
        // Handle relative URLs for internal APIs
        const fullUrl = source.url.startsWith('http') 
          ? source.url 
          : `${process.env.NEXT_PUBLIC_API_URL || process.env.VERCEL_URL || 'http://localhost:3000'}${source.url}`;

        const response = await fetch(fullUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          console.warn(`Failed to fetch from ${source.name}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        if (source.transform) {
          // Use custom transform function
          const transformedPools = source.transform(data);
          allPools.push(...transformedPools);
        } else {
          // Use default format (primary API)
          const pools = data.data || [];
          allPools.push(...pools);
        }

        console.log(`Successfully fetched ${source.name}: ${allPools.length} pools`);
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error);
      }
    }

    return allPools;
  }

  async getPoolsByProtocol(protocol: string): Promise<InvestmentData[]> {
    const allPools = await this.getAllPools();
    return allPools.filter(pool => pool.protocol === protocol);
  }

  async getTopPools(limit: number = 10): Promise<InvestmentData[]> {
    const allPools = await this.getAllPools();
    return allPools
      .sort((a, b) => b.totalAPY - a.totalAPY)
      .slice(0, limit);
  }

  // Method to add new source dynamically
  addSource(source: PoolSource) {
    this.sources.push(source);
  }

  // Method to enable/disable sources
  setSourceEnabled(sourceName: string, enabled: boolean) {
    const source = this.sources.find(s => s.name === sourceName);
    if (source) {
      source.enabled = enabled;
    }
  }
}

export const poolsService = new PoolsService(); 