import { NextResponse } from 'next/server';
import { InvestmentData } from '@/types/investments';

/**
 * @swagger
 * /api/protocols/moar/pools:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get all lending pools from Moar Market with APR calculation
 *     description: Returns all available lending pools with calculated APR (Interest Rate + Farming APY)
 *     responses:
 *       200:
 *         description: Pools retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InvestmentData'
 *                 count:
 *                   type: number
 *       500:
 *         description: Internal server error
 */

interface MoarPoolData {
  poolId: number;
  poolName: string;
  poolToken: string;
  totalAPR: number;
  interestRateComponent: number;
  farmingAPY: number;
  utilization: number;
  totalBorrows: number;
  totalDeposits: number;
  interestRate: number;
  feeOnInterest: number;
}

export async function GET() {
  try {
    console.log('🔍 Fetching Moar Market pools with APR calculation...');
    console.log('📊 API called at:', new Date().toISOString());
    
    // Check if APTOS_API_KEY is available
    const aptosApiKey = process.env.APTOS_API_KEY;
    console.log('🔑 APTOS_API_KEY exists:', !!aptosApiKey);
    
    // Prepare headers with API key if available
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (aptosApiKey) {
      headers['Authorization'] = `Bearer ${aptosApiKey}`;
    }
    
    // Step 1: Get all available pools
    const poolsResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        function: '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::pool::get_all_pools',
        type_arguments: [],
        arguments: []
      })
    });
    
    if (!poolsResponse.ok) {
      throw new Error(`Failed to fetch pools: ${poolsResponse.status}`);
    }
    
    const poolsData = await poolsResponse.json();
    console.log('📊 Raw pools data:', poolsData);
    
    // Extract the actual pools array from the response
    const pools = Array.isArray(poolsData) && poolsData.length > 0 ? poolsData[0] : poolsData;
    console.log('📊 Extracted pools count:', Array.isArray(pools) ? pools.length : 'Not an array');
    
    if (!Array.isArray(pools)) {
      throw new Error('Invalid pools data format');
    }

    const transformedPools: InvestmentData[] = [];
    
    // Step 2: Calculate APR for each pool
    console.log(`📊 Starting APR calculation for ${pools.length} pools`);
    for (let poolId = 0; poolId < pools.length; poolId++) {
      try {
        const pool = pools[poolId];
        console.log(`📈 Calculating APR for pool ${poolId}...`);
        
        // Get interest rate data
        const interestRateResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            function: '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::pool::get_interest_rate',
            type_arguments: [],
            arguments: [poolId.toString()]
          })
        });

        if (!interestRateResponse.ok) {
          console.warn(`Failed to get interest rate for pool ${poolId}:`, interestRateResponse.status);
          continue;
        }

        const interestRateData = await interestRateResponse.json();
        const [interestRate, feeOnInterest] = interestRateData;

        // Get pool totals for utilization calculation
        const totalBorrowsResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            function: '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::pool::pool_total_borrows',
            type_arguments: [],
            arguments: [poolId.toString()]
          })
        });

        const totalDepositsResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            function: '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::pool::pool_total_deposited',
            type_arguments: [],
            arguments: [poolId.toString()]
          })
        });

        if (!totalBorrowsResponse.ok || !totalDepositsResponse.ok) {
          console.warn(`Failed to get pool totals for pool ${poolId}`);
          continue;
        }

        const totalBorrows = await totalBorrowsResponse.json();
        const totalDeposits = await totalDepositsResponse.json();

        // Calculate utilization
        const utilization = totalDeposits > 0 ? Number(totalBorrows) / Number(totalDeposits) : 0;
        
        // Calculate interest rate component (both values are in micro-percentages)
        const interestRateValue = Number(interestRate);
        const feeOnInterestValue = Number(feeOnInterest);
        const interestRateComponent = (interestRateValue / 1000000) * utilization * (1 - feeOnInterestValue / 1000000);
        
        // Get farming APY
        let farmingAPY = 0;
        try {
          const farmingResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              function: '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::pool::get_farming_pool_apy',
              type_arguments: [],
              arguments: [poolId.toString(), 'APT-1']
            })
          });

          if (farmingResponse.ok) {
            const farmingData = await farmingResponse.json();
            farmingAPY = Number(farmingData) / 1000000; // Convert from micro-percentages
          }
        } catch (err) {
          console.warn(`Failed to get farming APY for pool ${poolId}:`, err);
        }

        // Calculate total APR
        const totalAPR = interestRateComponent + farmingAPY;

        // Determine pool token from underlying_asset
        const underlyingAsset = pool.underlying_asset?.inner;
        let poolToken = 'Unknown';
        let tokenAddress = '';
        
        if (underlyingAsset === '0xa') {
          poolToken = 'APT';
          tokenAddress = '0x1::aptos_coin::AptosCoin';
        } else if (underlyingAsset === '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b') {
          poolToken = 'USDC';
          tokenAddress = underlyingAsset;
        } else {
          poolToken = `Token ${poolId}`;
          tokenAddress = underlyingAsset || '';
        }
        
        const poolName = `${poolToken} Pool`;

        // Transform to InvestmentData format
        const poolEntry: InvestmentData = {
          asset: poolToken,
          provider: 'Moar Market',
          totalAPY: totalAPR, // Already in percentage (converted from micro-percentages)
          depositApy: totalAPR, // Same as total APY for lending
          borrowAPY: 0, // Moar Market doesn't have borrow APY for supply side
          token: tokenAddress, // Use the actual underlying asset address
          protocol: 'Moar Market',
          poolType: 'Lending',
          // Moar-specific data
          poolId: poolId,
          interestRateComponent: interestRateComponent, // Already in percentage
          farmingAPY: farmingAPY, // Already in percentage
          utilization: utilization * 100, // Keep utilization as percentage
          totalBorrows: Number(totalBorrows),
          totalDeposits: Number(totalDeposits),
          // Additional fields for compatibility
          tvlUSD: 0, // Not available from current API
          dailyVolumeUSD: 0 // Not available from current API
        };
        
        transformedPools.push(poolEntry);
        
        console.log(`✅ Pool ${poolId} APR calculated:`, {
          totalAPR: totalAPR,
          interestRateComponent: interestRateComponent,
          farmingAPY: farmingAPY,
          poolToken: poolToken
        });

      } catch (err) {
        console.warn(`❌ Error calculating APR for pool ${poolId}:`, err);
        // Continue with other pools instead of failing completely
      }
    }
    
    console.log(`📊 Final result: ${transformedPools.length} pools processed successfully`);

    // Sort by total APY in descending order
    transformedPools.sort((a, b) => (b.totalAPY || 0) - (a.totalAPY || 0));

    console.log(`✅ Transformed ${transformedPools.length} Moar Market pools`);

    return NextResponse.json({
      success: true,
      data: transformedPools,
      count: transformedPools.length
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600', // 5 minutes cache
        'Cdn-Cache-Control': 'max-age=300',
        'Surrogate-Control': 'max-age=300'
      }
    });

  } catch (error) {
    console.error('❌ Error fetching Moar Market pools:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: [],
        count: 0
      },
      { status: 500 }
    );
  }
}
