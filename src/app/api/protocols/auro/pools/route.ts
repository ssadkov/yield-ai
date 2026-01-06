import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('Auro Finance - API endpoint called');
  try {
    // Get base URL from environment or use default
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    
    // Fetch data from Auro Finance API with realistic browser headers
    const response = await fetch('https://api.auro.finance/api/v1/pool', {
      method: 'GET',
      headers: {
        'User-Agent': 'yieldai.app/1.0 (+https://yieldai.app/)',
        'Accept': 'application/json',
        'Origin': 'yieldai.app',
        'Referer': 'yieldai.app/',
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
    console.error('Auro Finance - API error:', error);
    
    // Return empty data instead of error to prevent breaking the dashboard
    return NextResponse.json({
      success: true,
      data: [],
      message: "Auro pools data temporarily unavailable",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 