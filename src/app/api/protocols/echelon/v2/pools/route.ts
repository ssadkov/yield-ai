import { NextResponse } from 'next/server';
import { InvestmentData } from '@/types/investments';

// Types for Echelon data processing
type RewardCoin = {
  symbol: string;
  price: number;
  rewardPerSec: number;
  totalAllocPoint: number;
  endTime?: number; // Unix timestamp when rewards end
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
  // Optional staking APR provided by Echelon for staking-like assets (fraction, not %)
  stakingApr?: number;
  // LTV fields
  ltv?: number;
  lt?: number;
  emodeLtv?: number;
  emodeLt?: number;
};

function calculateRewardsApr(
  pool: PoolRewardInfo,
  assetPrice: number,
  rewardCoins: Record<string, RewardCoin>
): number {
  const SECONDS_IN_YEAR = 31_536_000;
  const currentTime = Math.floor(Date.now() / 1000); // Current Unix timestamp
  let totalApr = 0;

  for (const reward of pool.rewards) {
    const rewardData = rewardCoins[reward.rewardKey];
    if (!rewardData || reward.allocPoint === 0 || pool.stakeAmount === 0) continue;

    // Check if rewards have ended
    if (rewardData.endTime && rewardData.endTime <= currentTime) {
      console.log(`Rewards for ${rewardData.symbol} have ended at ${new Date(rewardData.endTime * 1000).toISOString()}`);
      continue; // Skip expired rewards
    }

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
              endTime: rewardData.endTime, // Include endTime if available
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
    // Also collect staking APRs for staking-like assets
    const stakingAprs: Record<string, { aprPct: number; source: 'echelon' }> = {};

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

        // Calculate total APRs (только lending + staking, без rewards)
        const totalSupplyApr = (asset.supplyApr || 0) * 100;
        const totalBorrowApr = (asset.borrowApr || 0) * 100;

        // Collect staking APR mapping (if available and positive)
        const rawStakingApr = (asset as any).stakingApr as number | undefined;
        if (typeof rawStakingApr === 'number' && rawStakingApr > 0) {
          const aprPct = rawStakingApr * 100;
          const entry = { aprPct, source: 'echelon' as const };
          if (asset.address) {
            stakingAprs[asset.address] = entry;
          }
          if (asset.faAddress) {
            stakingAprs[asset.faAddress] = entry;
          }
        }

        // Create combined pool entry with both supply and borrow APRs
        const hasSupply = asset.supplyCap > 0;
        const hasBorrow = asset.borrowCap > 0;
        const hasStaking = typeof rawStakingApr === 'number' && rawStakingApr > 0;
        
        if (hasSupply || hasBorrow || hasStaking) {
          // Determine the main APR for sorting (use depositApy for correct total APR)
          let mainAPR = 0;
          if (hasSupply || hasStaking) {
            mainAPR = (hasSupply ? totalSupplyApr : 0) + (hasStaking ? rawStakingApr * 100 : 0) + (supplyRewardsApr * 100);
          }

          // Create pool type description
          let poolType = 'Lending';
          if (hasStaking && !hasSupply && !hasBorrow) {
            poolType = 'Staking';
          } else if (hasSupply && hasBorrow) {
            poolType = 'Lending (Supply + Borrow)';
          } else if (hasSupply) {
            poolType = 'Lending (Supply Only)';
          } else if (hasBorrow) {
            poolType = 'Lending (Borrow Only)';
          }

                     // Создаем основную запись пула
           const poolEntry = {
             asset: asset.symbol,
             provider: 'Echelon',
             totalAPY: mainAPR,
             // depositApy включает: lending APR + staking APR + rewards APR
             depositApy: (hasSupply ? totalSupplyApr : 0) + (hasStaking ? rawStakingApr * 100 : 0) + (supplyRewardsApr * 100),
             borrowAPY: hasBorrow ? totalBorrowApr : 0,
             token: asset.faAddress || asset.address, // Use faAddress if available, otherwise address
             protocol: 'Echelon',
             poolType: poolType,
             tvlUSD: (marketStat.totalShares + marketStat.totalLiability) * (asset.price || 0),
             dailyVolumeUSD: 0, // Echelon doesn't provide volume data
             // Additional Echelon-specific data
             supplyCap: asset.supplyCap,
             borrowCap: asset.borrowCap,
             supplyRewardsApr: supplyRewardsApr * 100,
             borrowRewardsApr: borrowRewardsApr * 100,
             marketAddress: asset.market,
             totalSupply: marketStat.totalShares,
             totalBorrow: marketStat.totalLiability,
             // Staking-specific fields (if applicable)
             stakingApr: hasStaking ? rawStakingApr * 100 : undefined,
             isStakingPool: hasStaking && !hasSupply && !hasBorrow,
             stakingToken: hasStaking ? asset.symbol : undefined,
             underlyingToken: hasStaking ? asset.symbol : undefined,
             // Добавляем разбивку APR для tooltip
             lendingApr: hasSupply ? (asset.supplyApr || 0) * 100 : 0,
             stakingAprOnly: hasStaking ? rawStakingApr * 100 : 0,
             // Общий Supply APR = Lending APR + Staking APR (без rewards)
             totalSupplyApr: (hasSupply ? (asset.supplyApr || 0) * 100 : 0) + (hasStaking ? rawStakingApr * 100 : 0),
             // LTV fields
             ltv: asset.ltv || 0,
             lt: asset.lt || 0,
             emodeLtv: asset.emodeLtv || 0,
             emodeLt: asset.emodeLt || 0
           };
          
          transformedPools.push(poolEntry);
          
          // Для APT токена используем основной адрес, но добавляем альтернативные адреса в поле token
          // Это позволит фронтенду правильно маппить данные без дублирования
          if (asset.symbol === 'APT') {
            // Обновляем основную запись, добавляя альтернативные адреса
            poolEntry.token = asset.faAddress || asset.address; // Основной адрес
            // Добавляем поле для альтернативных адресов APT
            (poolEntry as any).aptAlternativeAddresses = ['0xa', '0x0a'];
          }
        }
      });
    }

    // Sort by total APY in descending order, prioritizing supply APR over borrow APR
    transformedPools.sort((a, b) => {
      // Get the main APR for sorting (prefer supply/deposit APR over borrow APR)
      const aprA = a.depositApy || Math.abs(a.borrowAPY) || 0;
      const aprB = b.depositApy || Math.abs(b.borrowAPY) || 0;
      return aprB - aprA;
    });

    console.log(`Transformed ${transformedPools.length} Echelon pools`);

    return NextResponse.json({
      success: true,
      data: transformedPools,
      stakingAprs,
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