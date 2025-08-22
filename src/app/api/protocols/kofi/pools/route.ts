import { NextRequest, NextResponse } from 'next/server';
import { InvestmentData } from '@/types/investments';

/**
 * @swagger
 * /api/protocols/kofi/pools:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get KoFi Finance staking pool data
 *     description: Returns stkAPT staking pool data from Echelon API
 *     responses:
 *       200:
 *         description: Pool data retrieved successfully
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
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Fetching KoFi Finance staking pool data from Echelon...');
    
    // Fetch data from Echelon API to get stkAPT information
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
    
    if (!result.data || !Array.isArray(result.data.assets)) {
      throw new Error('No assets data found in Echelon response');
    }

    // Find stkAPT asset
    const stkAPTAsset = result.data.assets.find((asset: any) => 
      asset.symbol === 'stkAPT' || 
      asset.faAddress === '0x42556039b88593e768c97ab1a3ab0c6a17230825769304482dff8fdebe4c002b'
    );

    if (!stkAPTAsset) {
      console.log('stkAPT asset not found in Echelon data');
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No stkAPT staking pool found'
      });
    }

    // Get market stats for stkAPT
    const marketStats = result.data.marketStats || [];
    const stkAPTMarketStats = marketStats.find((item: any) => 
      Array.isArray(item) && 
      item.length === 2 && 
      (item[0] === stkAPTAsset.address || item[0] === stkAPTAsset.faAddress)
    );

    let totalShares = 0;
    let totalCash = 0;
    
    if (stkAPTMarketStats && stkAPTMarketStats[1]) {
      const stats = stkAPTMarketStats[1];
      totalShares = parseFloat(stats.totalShares || '0');
      totalCash = parseFloat(stats.totalCash || '0');
    }

    // Calculate TVL
    const price = stkAPTAsset.price || 0;
    const tvlUSD = totalShares * price;

    // Get staking APR
    const stakingApr = (stkAPTAsset.stakingApr || 0) * 100;

    // Create stkAPT staking pool
    const stkAPTPool: InvestmentData = {
      asset: 'stkAPT (Staking)',
      provider: 'Kofi Finance',
      totalAPY: stakingApr,
      depositApy: stakingApr,
      borrowAPY: 0,
      token: '0x1::aptos_coin::AptosCoin', // Use APT address for stkAPT staking
      protocol: 'Kofi Finance',
      poolType: 'Staking',
      tvlUSD: tvlUSD,
      dailyVolumeUSD: 0,
      // Staking-specific data
      supplyCap: stkAPTAsset.supplyCap || 0,
      borrowCap: 0, // Staking pools don't have borrowing
      supplyRewardsApr: stakingApr,
      borrowRewardsApr: 0,
      marketAddress: stkAPTAsset.market,
      totalSupply: totalShares,
      totalBorrow: 0,
      // Additional staking fields
      stakingApr: stakingApr,
      isStakingPool: true,
      stakingToken: 'stkAPT',
      underlyingToken: 'APT',
    };

    // console.log('Created stkAPT staking pool:', stkAPTPool);

    return NextResponse.json({
      success: true,
      data: [stkAPTPool],
      message: 'stkAPT staking pool data retrieved successfully'
    }, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
        'Cdn-Cache-Control': 'max-age=30',
        'Surrogate-Control': 'max-age=30'
      }
    });

  } catch (error) {
    console.error('Error fetching KoFi Finance pools:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch KoFi Finance pools',
        data: []
      },
      { status: 500 }
    );
  }
}
