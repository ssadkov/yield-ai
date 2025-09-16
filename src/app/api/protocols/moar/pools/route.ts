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
    
    // Step 1: Get all available pools
    const poolsResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    for (let poolId = 0; poolId < pools.length; poolId++) {
      try {
        console.log(`📈 Calculating APR for pool ${poolId}...`);
        
        // Get interest rate data
        const interestRateResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            function: '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::pool::pool_total_borrows',
            type_arguments: [],
            arguments: [poolId.toString()]
          })
        });

        const totalDepositsResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
            headers: {
              'Content-Type': 'application/json',
            },
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

        // Determine pool token
        const poolToken = poolId === 0 ? 'APT' : poolId === 1 ? 'USDC' : `Token ${poolId}`;
        const poolName = `${poolToken} Pool`;

        // Transform to InvestmentData format
        const poolEntry: InvestmentData = {
          asset: poolToken,
          provider: 'Moar Market',
          totalAPY: totalAPR * 100, // Convert to percentage
          depositApy: totalAPR * 100, // Same as total APY for lending
          token: poolId === 0 ? '0x1::aptos_coin::AptosCoin' : `0x${poolId}::token::Token`, // Placeholder for other tokens
          protocol: 'Moar Market',
          poolType: 'Lending',
          // Moar-specific data
          poolId: poolId,
          interestRateComponent: interestRateComponent * 100,
          farmingAPY: farmingAPY * 100,
          utilization: utilization * 100,
          totalBorrows: Number(totalBorrows),
          totalDeposits: Number(totalDeposits),
          // Additional fields for compatibility
          tvlUSD: 0, // Not available from current API
          dailyVolumeUSD: 0 // Not available from current API
        };
        
        transformedPools.push(poolEntry);
        
        console.log(`✅ Pool ${poolId} APR calculated:`, {
          totalAPR: totalAPR * 100,
          interestRateComponent: interestRateComponent * 100,
          farmingAPY: farmingAPY * 100
        });

      } catch (err) {
        console.warn(`Error calculating APR for pool ${poolId}:`, err);
        // Continue with other pools instead of failing completely
      }
    }

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
