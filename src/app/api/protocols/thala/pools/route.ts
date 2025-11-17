import { NextResponse } from 'next/server';

/**
 * @swagger
 * /api/protocols/thala/pools:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get all pools from Thala protocol
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
 *                     type: object
 *                     properties:
 *                       pool_id:
 *                         type: string
 *                       token_a:
 *                         type: string
 *                       token_b:
 *                         type: string
 *                       tvl:
 *                         type: number
 *                       apr:
 *                         type: number
 *                       poolType:
 *                         type: string
 *                       volume1d:
 *                         type: number
 *                       fees1d:
 *                         type: number
 *                       swapFee:
 *                         type: number
 *                       aprSources:
 *                         type: array
 *       500:
 *         description: Internal server error
 */
export async function GET() {
  try {
    const thalaApiUrl = "https://app.thala.fi/api/liquidity-pools";
    
    const response = await fetch(thalaApiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Thala API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      console.log('No valid pools data from Thala API');
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Transform Thala pools data to our format
    const transformedPools = data.data.map((pool: any) => {
      // Calculate total APR from all sources
      const totalApr = pool.apr && Array.isArray(pool.apr) 
        ? pool.apr.reduce((sum: number, source: any) => sum + (source.apr || 0), 0)
        : 0;

      // Extract token addresses and symbols from coinAddresses or type
      const coinAddresses = pool.metadata?.coinAddresses || [];
      const tokenAAddress = coinAddresses[0] || '';
      const tokenBAddress = coinAddresses[1] || '';

      // Try to extract token symbols from addresses
      // For common tokens, we can map addresses to symbols
      const getTokenSymbol = (address: string): string => {
        if (!address) return 'Unknown';
        
        // Common Aptos tokens
        if (address === '0x1::aptos_coin::AptosCoin' || address === '0xa') {
          return 'APT';
        }
        if (address.includes('USDC') || address.includes('usdc')) {
          return 'USDC';
        }
        if (address.includes('USDT') || address.includes('usdt')) {
          return 'USDT';
        }
        if (address.includes('thAPT') || address.includes('thapt')) {
          return 'thAPT';
        }
        
        // Extract symbol from Move type if available
        const match = address.match(/::(\w+)::/);
        if (match) {
          return match[1];
        }
        
        // Use last part of address as fallback
        const parts = address.split('::');
        return parts[parts.length - 1] || 'Unknown';
      };

      const tokenA = getTokenSymbol(tokenAAddress);
      const tokenB = getTokenSymbol(tokenBAddress);

      // Generate pool ID from lptAddress or type
      const poolId = pool.metadata?.lptAddress || pool.metadata?.type || `${tokenA}_${tokenB}`;

      return {
        pool_id: poolId,
        token_a: tokenA,
        token_b: tokenB,
        tvl: pool.tvl || 0,
        apr: totalApr, // Total APR from all sources (as decimal, e.g., 0.05 = 5%)
        poolType: pool.metadata?.poolType || 'Unknown',
        volume1d: pool.volume1d || 0,
        fees1d: pool.fees1d || 0,
        swapFee: pool.metadata?.swapFee || 0,
        aprSources: pool.apr || [], // Keep original APR sources for display
        stakeRatio: pool.stakeRatio || 0,
        balances: pool.balances || [],
        coinAddresses: coinAddresses,
        metadata: pool.metadata,
        // Additional fields for reference
        tvls: pool.tvls || [],
        version: pool.metadata?.version,
        isV2: pool.metadata?.isV2 || false
      };
    });

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
    console.error("Error fetching Thala pools:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch Thala pools",
        data: []
      },
      { status: 500 }
    );
  }
}

