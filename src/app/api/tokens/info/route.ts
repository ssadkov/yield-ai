import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';

/**
 * Universal Token Info API
 * 
 * Lookup token information with fallback to protocol APIs:
 * 1. Check tokenList.json (via tokenRegistry)
 * 2. If not found, check protocol APIs (Echelon, Panora, etc.)
 * 3. Cache result for 5 minutes
 * 
 * @swagger
 * /api/tokens/info:
 *   get:
 *     tags:
 *       - tokens
 *     summary: Get token information with protocol fallbacks
 *     parameters:
 *       - name: address
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Token address (faAddress or tokenAddress)
 *     responses:
 *       200:
 *         description: Token info retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                     symbol:
 *                       type: string
 *                     name:
 *                       type: string
 *                     decimals:
 *                       type: number
 *                     price:
 *                       type: number
 *                     logoUrl:
 *                       type: string
 *                     source:
 *                       type: string
 *                       description: Where the data was found (tokenList, echelon, panora)
 *       404:
 *         description: Token not found
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    const normalizedAddress = normalizeAddress(address);
    console.log('[Token Info API] Looking up token:', normalizedAddress);

    // 1. Try tokenList first (import here to avoid circular deps) with safe import
    try {
      const { safeImport } = await import('@/lib/utils/safeImport');
      const tokenList = await safeImport(() => import('@/lib/data/tokenList.json'));
      const foundToken = (tokenList.default.data.data as any[]).find(t => {
        const tokenAddr = t.tokenAddress ? normalizeAddress(t.tokenAddress) : null;
        const faAddr = t.faAddress ? normalizeAddress(t.faAddress) : null;
        return tokenAddr === normalizedAddress || faAddr === normalizedAddress;
      });

      if (foundToken) {
        console.log('[Token Info API] Found in tokenList:', foundToken.symbol);
        return NextResponse.json({
          success: true,
          data: {
            address: foundToken.faAddress || foundToken.tokenAddress,
            symbol: foundToken.symbol,
            name: foundToken.name,
            decimals: foundToken.decimals,
            price: foundToken.usdPrice ? parseFloat(foundToken.usdPrice) : null,
            logoUrl: foundToken.logoUrl,
            source: 'tokenList'
          }
        });
      }
    } catch (error) {
      console.warn('[Token Info API] Error checking tokenList:', error);
    }

    // 2. Try Echelon API
    try {
      console.log('[Token Info API] Checking Echelon API...');
      const echelonResponse = await fetch('https://app.echelon.market/api/markets?network=aptos_mainnet', {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'YieldAI/1.0',
        },
      });

      if (echelonResponse.ok) {
        const echelonData = await echelonResponse.json();
        const asset = echelonData.data.assets?.find((a: any) => {
          const assetAddr = a.address ? normalizeAddress(a.address) : null;
          const assetFaAddr = a.faAddress ? normalizeAddress(a.faAddress) : null;
          return assetAddr === normalizedAddress || assetFaAddr === normalizedAddress;
        });

        if (asset) {
          console.log('[Token Info API] Found in Echelon:', asset.symbol);
          return NextResponse.json({
            success: true,
            data: {
              address: asset.faAddress || asset.address,
              symbol: asset.symbol,
              name: asset.name,
              decimals: asset.decimals || 8,
              price: asset.price || null,
              logoUrl: asset.icon ? `https://app.echelon.market${asset.icon}` : null,
              source: 'echelon',
              // Additional Echelon-specific data
              market: asset.market,
              supplyCap: asset.supplyCap,
              borrowCap: asset.borrowCap,
              supplyApr: asset.supplyApr,
              borrowApr: asset.borrowApr
            }
          });
        }
      }
    } catch (error) {
      console.warn('[Token Info API] Error checking Echelon:', error);
    }

    // 3. Try Panora API
    try {
      console.log('[Token Info API] Checking Panora API...');
      const panoraResponse = await fetch(
        `https://api.panora.exchange/tokens?chainId=1&address=${encodeURIComponent(address)}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (panoraResponse.ok) {
        const panoraData = await panoraResponse.json();
        if (panoraData.data && panoraData.data.length > 0) {
          const token = panoraData.data[0];
          console.log('[Token Info API] Found in Panora:', token.symbol);
          return NextResponse.json({
            success: true,
            data: {
              address: token.faAddress || token.tokenAddress,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              price: token.usdPrice ? parseFloat(token.usdPrice) : null,
              logoUrl: token.logoUrl,
              source: 'panora'
            }
          });
        }
      }
    } catch (error) {
      console.warn('[Token Info API] Error checking Panora:', error);
    }

    // 4. Not found in any source
    console.log('[Token Info API] Token not found in any source');
    return NextResponse.json(
      {
        success: false,
        error: 'Token not found',
        address: normalizedAddress
      },
      { status: 404 }
    );

  } catch (error) {
    console.error('[Token Info API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
