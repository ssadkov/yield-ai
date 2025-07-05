import { PoolSource } from '@/lib/services/pools/poolsService';

// Configuration for pool data sources
export const poolSources: PoolSource[] = [
  {
    name: 'Primary Yield API',
    url: 'https://yield-a.vercel.app/api/aptos/markets',
    enabled: true
  },
  // Hyperion pools API
  {
    name: 'Hyperion Pools API',
    url: '/api/protocols/hyperion/pools',
    enabled: true,
    transform: (data: any) => {
      // Transform Hyperion pools data to InvestmentData format
      const filtered = (data.data || [])
        .filter((pool: any) => {
          // Filter pools with daily volume > $100 (reasonable threshold)
          const dailyVolume = parseFloat(pool.dailyVolumeUSD || "0");
          return dailyVolume > 100;
        });
      
      return filtered.map((pool: any) => {
        // Calculate total APY from fee APR and farm APR
        const feeAPR = parseFloat(pool.feeAPR || "0");
        const farmAPR = parseFloat(pool.farmAPR || "0");
        const totalAPY = feeAPR + farmAPR;
        
        // Get token info from pool object
        const token1Info = pool.pool?.token1Info || pool.token1Info;
        const token2Info = pool.pool?.token2Info || pool.token2Info;
        
        return {
          asset: `${token1Info?.symbol || 'Unknown'}/${token2Info?.symbol || 'Unknown'}`,
          provider: 'Hyperion',
          totalAPY: totalAPY,
          depositApy: totalAPY, // For DEX pools, deposit APY is the same as total APY
          borrowAPY: 0, // DEX pools don't have borrowing
          token: pool.poolId || pool.id,
          protocol: 'Hyperion',
          dailyVolumeUSD: parseFloat(pool.dailyVolumeUSD || "0"),
          tvlUSD: parseFloat(pool.tvlUSD || "0"),
          // Include token information for DEX pools
          token1Info: token1Info,
          token2Info: token2Info
        };
      });
    }
  },
  // Example of how to add a new protocol API
  {
    name: 'Example Protocol API',
    url: 'https://api.example-protocol.com/pools',
    enabled: false, // Set to true when you have the actual API
    transform: (data: any) => {
      // Transform the API response to match InvestmentData format
      return (data.pools || []).map((pool: any) => ({
        asset: pool.tokenSymbol || pool.asset,
        provider: pool.protocol || 'Example Protocol',
        totalAPY: pool.totalAPY || pool.apy || 0,
        depositApy: pool.depositAPY || pool.supplyAPY || 0,
        borrowAPY: pool.borrowAPY || 0,
        token: pool.tokenAddress || pool.address,
        protocol: pool.protocolName || 'Example Protocol'
      }));
    }
  }
];

// Helper function to get enabled sources
export const getEnabledSources = () => {
  return poolSources.filter(source => source.enabled);
};

// Helper function to add a new source
export const addPoolSource = (source: PoolSource) => {
  poolSources.push(source);
};

// Helper function to enable/disable a source
export const setSourceEnabled = (sourceName: string, enabled: boolean) => {
  const source = poolSources.find(s => s.name === sourceName);
  if (source) {
    source.enabled = enabled;
  }
}; 