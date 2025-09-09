import { NextRequest, NextResponse } from 'next/server';
import { getTokenInfo } from '@/lib/tokens/tokenRegistry';

async function callView(functionFullname: string, args: any[]): Promise<any> {
  const url = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      function: functionFullname,
      type_arguments: [],
      arguments: args
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[Moar Market] VIEW ERROR:', functionFullname, 'args:', JSON.stringify(args), '->', res.status, res.statusText, text);
    throw new Error(`VIEW ERROR ${res.status} ${res.statusText}: ${text}`);
  }
  
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * @swagger
 * /api/protocols/moar/userPositions:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get user positions in Moar Market protocol
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: User wallet address
 *     responses:
 *       200:
 *         description: User positions retrieved successfully
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
 *                       poolId:
 *                         type: number
 *                       assetName:
 *                         type: string
 *                       balance:
 *                         type: string
 *                       value:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [deposit]
 *                       assetInfo:
 *                         type: object
 *       400:
 *         description: Invalid address
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Moar Market userPositions API called with address:', address);

    // Step 1: Get all available pools
    const poolsResponse = await callView('0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::pool::get_all_pools', []);
    console.log('📊 Moar Market pools response:', poolsResponse);
    console.log('📊 Pools response type:', typeof poolsResponse);
    console.log('📊 Pools response length:', Array.isArray(poolsResponse) ? poolsResponse.length : 'Not an array');
    
    // Extract the actual pools array from the response
    const pools = Array.isArray(poolsResponse) && poolsResponse.length > 0 ? poolsResponse[0] : poolsResponse;
    console.log('📊 Extracted pools:', pools);
    console.log('📊 Extracted pools count:', Array.isArray(pools) ? pools.length : 'Not an array');

    const positions: any[] = [];

    // Step 2: Check user positions for each pool
    for (let poolId = 0; poolId < pools.length; poolId++) {
      try {
        const positionData = await callView('0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::lens::get_lp_shares_and_deposited_amount', [poolId.toString(), address]);
        console.log(`📈 Pool ${poolId} position data:`, positionData);

        // positionData is an array: [lp_shares, deposited_amount, ...]
        const depositedAmount = positionData[1]; // Second number is deposited amount
        
        if (depositedAmount && depositedAmount !== '0') {
          const pool = pools[poolId];
          const underlyingAsset = pool.underlying_asset.inner;
          
          try {
            // Get token info from tokenList
            const tokenInfo = await getTokenInfo(underlyingAsset);
            
            // Calculate USD value (simplified - would need price data)
            const amount = parseFloat(depositedAmount) / Math.pow(10, tokenInfo.decimals);
            const price = parseFloat(tokenInfo.usdPrice || '0');
            const value = amount * price;

            positions.push({
              poolId: poolId,
              assetName: tokenInfo.symbol,
              balance: depositedAmount,
              value: value.toString(),
              type: 'deposit',
              assetInfo: {
                symbol: tokenInfo.symbol,
                logoUrl: tokenInfo.logoUrl,
                decimals: tokenInfo.decimals,
                name: tokenInfo.name
              }
            });
          } catch (tokenError) {
            console.warn(`Failed to get token info for ${underlyingAsset}:`, tokenError);
            // Fallback with basic info
            positions.push({
              poolId: poolId,
              assetName: pool.name || 'Unknown',
              balance: depositedAmount,
              value: '0',
              type: 'deposit',
              assetInfo: {
                symbol: pool.name || 'Unknown',
                logoUrl: null,
                decimals: 8,
                name: pool.name || 'Unknown'
              }
            });
          }
        }
      } catch (error) {
        console.warn(`Error checking pool ${poolId}:`, error);
        continue;
      }
    }

    console.log('✅ Moar Market positions found:', positions.length);

    return NextResponse.json({
      success: true,
      data: positions
    });

  } catch (error) {
    console.error('Error fetching Moar Market user positions:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}
