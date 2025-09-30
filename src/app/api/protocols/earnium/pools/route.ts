import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching Earnium pools from API...');
    
    // Fetch ALL pages to get complete data
    const allPools: any[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    let totalCount = 0;

    while (hasMorePages) {
      console.log(`📄 Fetching page ${currentPage}...`);
      
      const response = await fetch(`https://api.earnium.io/api/v1/pool/list-pool-explore?page=${currentPage}&limit=20&sort_by=tvl&order=desc&stable=null`, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'YieldAI/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.data || !result.data.dataListPool) {
        console.log(`No data found on page ${currentPage}, stopping pagination`);
        hasMorePages = false;
        break;
      }

      const pools = result.data.dataListPool;
      totalCount = result.data.totalCount || 0;
      
      console.log(`📊 Page ${currentPage}: ${pools.length} pools, total so far: ${allPools.length}, total available: ${totalCount}`);
      
      allPools.push(...pools);
      
      // Stop if we got fewer pools than requested (last page) or reached total count
      hasMorePages = pools.length === 20 && allPools.length < totalCount;
      currentPage++;
      
      // Safety check to prevent infinite loops
      if (currentPage > 10) {
        console.log('Safety limit reached, stopping pagination');
        hasMorePages = false;
      }
    }

    console.log(`📊 Total pools loaded: ${allPools.length} out of ${totalCount} available`);

    // Filter pools by volume (similar to Hyperion filter)
    const filteredPools = allPools.filter((pool: any) => {
      const dailyVolume = pool.day?.volume || pool.volume1Day || 0;
      return dailyVolume > 1000; // Filter pools with daily volume > $1000
    });

    console.log(`📊 After volume filter: ${filteredPools.length} pools (filtered from ${allPools.length})`);

    // Transform Earnium pools data to InvestmentData format
    const transformedPools = filteredPools.map((pool: any) => {
      // Get the best APR from subPools or use main pool APR
      let bestApr = pool.totalApr || pool.apr || 0;
      let bestSubPool = null;
      
      if (pool.subPools && pool.subPools.length > 0) {
        // Find subpool with highest APR
        bestSubPool = pool.subPools.reduce((best: any, current: any) => 
          (current.apr || 0) > (best.apr || 0) ? current : best
        );
        bestApr = bestSubPool.apr || bestApr;
      }

      // Extract reward tokens information
      const rewardTokens: Array<{
        tokenAddress: string;
        apr: number;
        amount: number;
        source: string;
      }> = [];
      
      // Main pool incentive rewards
      if (pool.incentiveApr?.info && Array.isArray(pool.incentiveApr.info)) {
        pool.incentiveApr.info.forEach((reward: any) => {
          rewardTokens.push({
            tokenAddress: reward.address,
            apr: reward.value || 0,
            amount: reward.amount || 0,
            source: 'Main Pool'
          });
        });
      }
      
      // SubPool incentive rewards
      if (bestSubPool?.incentiveApr?.info && Array.isArray(bestSubPool.incentiveApr.info)) {
        bestSubPool.incentiveApr.info.forEach((reward: any) => {
          rewardTokens.push({
            tokenAddress: reward.address,
            apr: reward.value || 0,
            amount: reward.amount || 0,
            source: 'SubPool'
          });
        });
      }

      // Calculate APR breakdown
      const aprBreakdown = {
        baseFeeApr: pool.feeApr?.value || pool.apr || 0,
        incentiveApr: pool.incentiveApr?.value || 0,
        totalApr: pool.totalApr || bestApr,
        breakdown: {
          tradingFees: pool.feeApr?.value || pool.apr || 0,
          rewards: pool.incentiveApr?.value || 0,
          subPoolRewards: bestSubPool?.incentiveApr?.value || 0
        },
        rewardTokens: rewardTokens
      };

      return {
        asset: pool.name || `${pool.token0?.symbol || 'Unknown'}/${pool.token1?.symbol || 'Unknown'}`,
        provider: 'Earnium',
        totalAPY: bestApr,
        depositApy: bestApr, // For DEX pools, deposit APY is the same as total APY
        borrowAPY: 0, // DEX pools don't have borrowing
        token: pool.address || '',
        protocol: 'Earnium',
        poolType: pool.stable ? 'Stable' : 'Volatile',
        tvlUSD: pool.tvl || 0,
        dailyVolumeUSD: pool.day?.volume || pool.volume1Day || 0,
        // Additional Earnium-specific data
        poolId: pool._id,
        poolAddress: pool.address,
        symbol: pool.symbol,
        feeTier: pool.feeTier,
        token0: pool.token0,
        token1: pool.token1,
        bestSubPool: bestSubPool,
        aprBreakdown: aprBreakdown,
        subPools: pool.subPools || [],
        description: `${pool.token0?.symbol || 'Unknown'}/${pool.token1?.symbol || 'Unknown'} liquidity pool on Earnium`
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedPools,
      meta: {
        totalPools: transformedPools.length,
        totalAvailable: totalCount,
        totalLoaded: allPools.length,
        pagesFetched: currentPage - 1,
        volumeFilter: '> $1000 daily volume'
      }
    });

  } catch (error: any) {
    console.error('[Earnium Pools API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Failed to fetch Earnium pools' 
      },
      { status: 500 }
    );
  }
}
