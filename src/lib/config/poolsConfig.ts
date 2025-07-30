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
          // Filter pools with daily volume > $1000 (reasonable threshold)
          const dailyVolume = parseFloat(pool.dailyVolumeUSD || "0");
          return dailyVolume > 1000;
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
  // Tapp Exchange pools API
  {
    name: 'Tapp Exchange Pools API',
    url: '/api/protocols/tapp/pools',
    enabled: true,
    transform: (data: any) => {
      // Transform Tapp pools data to InvestmentData format
      const filtered = (data.data || [])
        .filter((pool: any) => {
          // Filter pools with daily volume > $1000 (reasonable threshold)
          const dailyVolume = parseFloat(pool.volume_7d || "0") / 7; // Convert 7d volume to daily
          return dailyVolume > 1000;
        });
      
      return filtered.map((pool: any) => {
        // APR is already in decimal form from our API wrapper
        const totalAPY = parseFloat(pool.apr || "0") * 100; // Convert to percentage
        
        // Create token info objects for DEX display
        const token1Info = {
          symbol: pool.token_a || 'Unknown',
          name: pool.token_a || 'Unknown',
          logoUrl: pool.tokens?.[0]?.img || undefined,
          decimals: 8
        };
        
        const token2Info = {
          symbol: pool.token_b || 'Unknown',
          name: pool.token_b || 'Unknown',
          logoUrl: pool.tokens?.[1]?.img || undefined,
          decimals: 8
        };
        
        return {
          asset: `${token1Info.symbol}/${token2Info.symbol}`,
          provider: 'Tapp Exchange',
          totalAPY: totalAPY,
          depositApy: totalAPY, // For DEX pools, deposit APY is the same as total APY
          borrowAPY: 0, // DEX pools don't have borrowing
          token: pool.pool_id || pool.poolId,
          protocol: 'Tapp Exchange',
          dailyVolumeUSD: parseFloat(pool.volume_7d || "0") / 7, // Convert 7d to daily
          tvlUSD: parseFloat(pool.tvl || "0"),
          // Include token information for DEX pools
          token1Info: token1Info,
          token2Info: token2Info,
          // Additional DEX pool information
          poolType: 'DEX',
          feeTier: parseFloat(pool.fee_tier || "0"),
          volume7d: parseFloat(pool.volume_7d || "0")
        };
      });
    }
  },
  // Auro Finance pools API - Collateral pools only
  {
    name: 'Auro Finance Pools API',
    url: '/api/protocols/auro/pools',
    enabled: true,
    transform: (data: any) => {
      // Transform Auro pools data to InvestmentData format
      // Only include COLLATERAL pools (Supply pools)
      const collateralPools = (data.data || [])
        .filter((pool: any) => pool.type === 'COLLATERAL')
        .filter((pool: any) => {
          // Filter out pools with very low TVL or no APY
          const tvl = parseFloat(pool.tvl || "0");
          const totalAPY = (pool.totalSupplyApr || 0);
          return tvl > 1000 && totalAPY > 0;
        });
      
      return collateralPools.map((pool: any) => {
        // Calculate total APY from supply components
        const supplyApr = parseFloat(pool.supplyApr || "0");
        const supplyIncentiveApr = parseFloat(pool.supplyIncentiveApr || "0");
        const stakingApr = parseFloat(pool.stakingApr || "0");
        const totalAPY = supplyApr + supplyIncentiveApr + stakingApr;
        
        return {
          asset: pool.collateralTokenSymbol || 'Unknown',
          provider: 'Auro Finance',
          totalAPY: totalAPY,
          depositApy: totalAPY, // Supply APY is the deposit APY
          borrowAPY: 0, // We're only including collateral pools
          token: pool.collateralTokenAddress || pool.poolAddress,
          protocol: 'Auro Finance',
          tvlUSD: parseFloat(pool.tvl || "0"),
          // Additional Auro-specific data
          poolType: 'Lending',
          // Store original pool data for reference
          originalPool: pool
        };
      });
    }
  },
  // Amnis Finance pools API
  {
    name: 'Amnis Finance Pools API',
    url: '/api/protocols/amnis/pools',
    enabled: true,
    transform: (data: any) => {
      // Transform Amnis pools data to InvestmentData format
      const pools = data.pools || [];
      
      return pools.map((pool: any) => {
        return {
          asset: pool.asset || 'Unknown',
          provider: 'Amnis Finance',
          totalAPY: pool.apr || 0,
          depositApy: pool.apr || 0, // Staking APY is the deposit APY
          borrowAPY: 0, // Staking pools don't have borrowing
          token: pool.token || '',
          protocol: 'Amnis Finance',
          poolType: 'Staking',
          // Additional Amnis-specific data
          stakingToken: pool.stakingToken,
          totalStaked: pool.totalStaked,
          minStake: pool.minStake,
          maxStake: pool.maxStake,
          isActive: pool.isActive
        };
      });
    }
  },
  // Echelon Markets API v2
  {
    name: 'Echelon Markets API v2',
    url: '/api/protocols/echelon/v2/pools',
    enabled: true,
    transform: (data: any) => {
      // Transform Echelon pools data to InvestmentData format
      // Data is already in InvestmentData format from the API
      const pools = data.data || [];
      
      return pools.map((pool: any) => {
        return {
          asset: pool.asset,
          provider: pool.provider,
          totalAPY: pool.totalAPY,
          depositApy: pool.depositApy,
          borrowAPY: pool.borrowAPY,
          token: pool.token,
          protocol: pool.protocol,
          poolType: pool.poolType,
          tvlUSD: pool.tvlUSD,
          dailyVolumeUSD: pool.dailyVolumeUSD,
          // Additional Echelon-specific data
          supplyCap: pool.supplyCap,
          borrowCap: pool.borrowCap,
          supplyRewardsApr: pool.supplyRewardsApr,
          borrowRewardsApr: pool.borrowRewardsApr,
          marketAddress: pool.marketAddress,
          totalSupply: pool.totalSupply,
          totalBorrow: pool.totalBorrow
        };
      });
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