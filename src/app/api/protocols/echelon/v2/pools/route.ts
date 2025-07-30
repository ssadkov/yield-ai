import { NextResponse } from 'next/server';
import { InvestmentData } from '@/types/investments';

// Types for Echelon data processing
type RewardCoin = {
  symbol: string;
  price: number;
  rewardPerSec: number;
  totalAllocPoint: number;
};

type PoolRewardInfo = {
  stakeAmount: number;
  rewards: {
    rewardKey: string;
    allocPoint: number;
  }[];
};

type MarketAsset = {
  address: string;
  faAddress?: string;
  symbol: string;
  name: string;
  price: number;
  supplyApr: number;
  borrowApr: number;
  market: string;
  supplyCap: number;
  borrowCap: number;
};

function calculateRewardsApr(
  pool: PoolRewardInfo,
  assetPrice: number,
  rewardCoins: Record<string, RewardCoin>
): number {
  const SECONDS_IN_YEAR = 31_536_000;
  let totalApr = 0;

  for (const reward of pool.rewards) {
    const rewardData = rewardCoins[reward.rewardKey];
    if (!rewardData || reward.allocPoint === 0 || pool.stakeAmount === 0) continue;

    const rewardPerSecForPool =
      (rewardData.rewardPerSec * reward.allocPoint) / rewardData.totalAllocPoint;

    const annualRewardUSD = rewardPerSecForPool * SECONDS_IN_YEAR * rewardData.price;
    const tvlUSD = pool.stakeAmount * assetPrice;
    const apr = annualRewardUSD / tvlUSD;
    totalApr += apr;
  }

  return totalApr;
}

export async function GET() {
  try {
    console.log('Fetching Echelon markets data...');
    
    // Fetch data from Echelon API
    const response = await fetch('https://app.echelon.market/api/markets?network=aptos_mainnet', {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'YieldAI/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.data) {
      throw new Error('No data found in response');
    }

    const transformedPools: InvestmentData[] = [];

    // Create maps for data processing
    const marketStatsMap = new Map<string, any>();
    const supplyPoolsMap = new Map<string, PoolRewardInfo>();
    const borrowPoolsMap = new Map<string, PoolRewardInfo>();
    const rewardCoinsMap: Record<string, RewardCoin> = {};

    // Process market stats
    if (Array.isArray(result.data.marketStats)) {
      result.data.marketStats.forEach((item: any) => {
        if (Array.isArray(item) && item.length === 2) {
          const [tokenAddress, stats] = item;
          marketStatsMap.set(tokenAddress, {
            totalShares: stats.totalShares || 0,
            totalLiability: stats.totalLiability || 0,
            totalReserve: stats.totalReserve || 0,
            totalCash: stats.totalCash || 0,
          });
        }
      });
    }

    // Process farming data
    if (result.data.farming) {
      // Process reward coins
      if (result.data.farming.rewards) {
        result.data.farming.rewards.forEach((rewardItem: any) => {
          if (Array.isArray(rewardItem) && rewardItem.length === 2) {
            const [rewardKey, rewardData] = rewardItem;
            rewardCoinsMap[rewardKey] = {
              symbol: rewardData.rewardCoin.symbol,
              price: rewardData.rewardCoin.price,
              rewardPerSec: rewardData.rewardPerSec,
              totalAllocPoint: rewardData.totalAllocPoint,
            };
          }
        });
      }

      // Process supply pools
      if (result.data.farming.pools?.supply) {
        result.data.farming.pools.supply.forEach((poolItem: any) => {
          if (Array.isArray(poolItem) && poolItem.length === 2) {
            const [marketAddress, poolData] = poolItem;
            supplyPoolsMap.set(marketAddress, {
              stakeAmount: poolData.stakeAmount,
              rewards: poolData.rewards || [],
            });
          }
        });
      }

      // Process borrow pools
      if (result.data.farming.pools?.borrow) {
        result.data.farming.pools.borrow.forEach((poolItem: any) => {
          if (Array.isArray(poolItem) && poolItem.length === 2) {
            const [marketAddress, poolData] = poolItem;
            borrowPoolsMap.set(marketAddress, {
              stakeAmount: poolData.stakeAmount,
              rewards: poolData.rewards || [],
            });
          }
        });
      }
    }

    // Process assets and create InvestmentData entries
    if (Array.isArray(result.data.assets)) {
      result.data.assets.forEach((asset: MarketAsset) => {
        // Get market stats for this asset
        let marketStat = marketStatsMap.get(asset.address);
        if (!marketStat && asset.faAddress) {
          marketStat = marketStatsMap.get(asset.faAddress);
        }

        if (!marketStat) {
          return; // Skip if no market stats available
        }

        // Skip tokens where both supplyCap and borrowCap are 0 AND no activity
        const hasActivity = marketStat.totalShares > 0 || marketStat.totalLiability > 0;
        if (asset.supplyCap === 0 && asset.borrowCap === 0 && !hasActivity) {
          return;
        }

        // Calculate rewards APR
        const supplyPool = supplyPoolsMap.get(asset.market);
        const borrowPool = borrowPoolsMap.get(asset.market);
        
        let supplyRewardsApr = 0;
        let borrowRewardsApr = 0;
        
        if (supplyPool && supplyPool.rewards.length > 0) {
          supplyRewardsApr = calculateRewardsApr(supplyPool, asset.price || 0, rewardCoinsMap);
        }
        
        if (borrowPool && borrowPool.rewards.length > 0) {
          borrowRewardsApr = calculateRewardsApr(borrowPool, asset.price || 0, rewardCoinsMap);
        }

        // Calculate total APRs
        const totalSupplyApr = (asset.supplyApr || 0) * 100 + supplyRewardsApr * 100;
        const totalBorrowApr = (asset.borrowApr || 0) * 100 + borrowRewardsApr * 100;

        // Create Supply pool entry if supply is allowed
        if (asset.supplyCap > 0) {
          transformedPools.push({
            asset: asset.symbol,
            provider: 'Echelon',
            totalAPY: totalSupplyApr,
            depositApy: totalSupplyApr,
            borrowAPY: 0,
            token: asset.address,
            protocol: 'Echelon',
            poolType: 'Lending',
            tvlUSD: marketStat.totalShares * (asset.price || 0),
            dailyVolumeUSD: 0, // Echelon doesn't provide volume data
            // Additional Echelon-specific data
            supplyCap: asset.supplyCap,
            borrowCap: asset.borrowCap,
            supplyRewardsApr: supplyRewardsApr * 100,
            borrowRewardsApr: borrowRewardsApr * 100,
            marketAddress: asset.market,
            totalSupply: marketStat.totalShares,
            totalBorrow: marketStat.totalLiability,
          });
        }

        // Create Borrow pool entry if borrow is allowed
        if (asset.borrowCap > 0) {
          transformedPools.push({
            asset: `${asset.symbol} (Borrow)`,
            provider: 'Echelon',
            totalAPY: -totalBorrowApr, // Negative for borrowing
            depositApy: 0,
            borrowAPY: totalBorrowApr,
            token: asset.address,
            protocol: 'Echelon',
            poolType: 'Lending',
            tvlUSD: marketStat.totalLiability * (asset.price || 0),
            dailyVolumeUSD: 0,
            // Additional Echelon-specific data
            supplyCap: asset.supplyCap,
            borrowCap: asset.borrowCap,
            supplyRewardsApr: supplyRewardsApr * 100,
            borrowRewardsApr: borrowRewardsApr * 100,
            marketAddress: asset.market,
            totalSupply: marketStat.totalShares,
            totalBorrow: marketStat.totalLiability,
          });
        }
      });
    }

    // Sort by total APY in descending order
    transformedPools.sort((a, b) => Math.abs(b.totalAPY) - Math.abs(a.totalAPY));

    console.log(`Transformed ${transformedPools.length} Echelon pools`);

    return NextResponse.json({
      success: true,
      data: transformedPools
    }, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
        'Cdn-Cache-Control': 'max-age=30',
        'Surrogate-Control': 'max-age=30'
      }
    });

  } catch (error) {
    console.error('Error fetching Echelon pools:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Echelon pools',
        data: []
      },
      { status: 500 }
    );
  }
} 