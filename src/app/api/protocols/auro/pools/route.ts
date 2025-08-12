import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
  
    
    // Fetch data from Auro Finance API
    const response = await fetch('https://api.auro.finance/api/v1/pool', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Auro API returned status ${response.status}`);
    }

    const data = await response.json();
    
    // Transform data to a more usable format
    const poolsData = data.map((item: any) => {
      if (item.type === 'COLLATERAL') {
        return {
          type: item.type,
          poolAddress: item.address,
          poolName: item.pool.name,
          collateralTokenAddress: item.pool.collateralTokenAddress,
          collateralTokenSymbol: item.pool.token?.symbol || 'Unknown',
          supplyApr: item.pool.supplyApr || 0,
          supplyIncentiveApr: item.pool.supplyIncentiveApr || 0,
          stakingApr: item.pool.stakingApr || 0,
          totalSupplyApr: (item.pool.supplyApr || 0) + (item.pool.supplyIncentiveApr || 0) + (item.pool.stakingApr || 0),
          rewardPoolAddress: item.pool.rewardPoolAddress,
          tvl: item.pool.tvl,
          ltvBps: item.pool.ltvBps,
          liquidationThresholdBps: item.pool.liquidationThresholdBps,
          liquidationFeeBps: item.pool.liquidationFeeBps,
          borrowAmountFromPool: item.pool.borrowAmountFromPool || 0,
          token: item.pool.token
        };
      } else if (item.type === 'BORROW') {
        return {
          type: item.type,
          poolAddress: item.address,
          poolName: item.pool.name,
          borrowApr: item.pool.borrowApr || 0,
          borrowIncentiveApr: item.pool.borrowIncentiveApr || 0,
          totalBorrowApr: (item.pool.borrowApr || 0) + (item.pool.borrowIncentiveApr || 0),
          rewardPoolAddress: item.pool.rewardPoolAddress,
          borrowRewardsPoolAddress: item.pool.borrowRewardsPool,
          tvl: item.pool.tvl,
          token: item.pool.token
        };
      }
      return null;
    }).filter(Boolean);

    const result = {
      success: true,
      data: poolsData,
      message: "Auro pools data retrieved successfully"
    };

  
    return NextResponse.json(result);

  } catch (error) {
  console.error('Auro pools error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch Auro pools data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 