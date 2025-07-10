import { NextResponse } from 'next/server';

/**
 * @swagger
 * /api/protocols/tapp/pools:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get all pools from Tapp Exchange protocol
 *     parameters:
 *       - in: query
 *         name: chain
 *         schema:
 *           type: string
 *         description: Chain filter (e.g., aptos)
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of pools per page
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
 *                       fee_tier:
 *                         type: number
 *                       volume_7d:
 *                         type: number
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     total:
 *                       type: number
 *       500:
 *         description: Internal server error
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get("chain") || "aptos";
    const page = searchParams.get("page") || "1";
    const limit = searchParams.get("limit") || "50";

    // Create JSON-RPC request to Tapp API
    const tappApiUrl = "https://api.tapp.exchange/api/v1";
    const requestBody = {
      method: "public/pool",
      jsonrpc: "2.0",
      id: 4,
      params: {
        query: {
          page: parseInt(page),
          pageSize: parseInt(limit)
        }
      }
    };

    console.log('Fetching Tapp pools from:', tappApiUrl);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(tappApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'http://localhost:3000',
        'Referer': 'http://localhost:3000/'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      console.error(`Tapp API returned ${response.status}: ${response.statusText}`);
      throw new Error(`Tapp API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('Tapp API response:', data);

    // Check if we have valid data (JSON-RPC format)
    if (!data.result || !data.result.data) {
      console.log('No valid pools data, returning empty array');
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0
        }
      });
    }

    // Transform the data to match our expected format
    const transformedPools = data.result.data.map((pool: any) => ({
      pool_id: pool.poolId,
      token_a: pool.tokens[0]?.symbol || 'Unknown',
      token_b: pool.tokens[1]?.symbol || 'Unknown',
      tvl: parseFloat(pool.tvl || "0"),
      apr: parseFloat(pool.apr?.totalAprPercentage || "0") / 100, // Convert percentage to decimal
      fee_tier: parseFloat(pool.feeTier || "0"),
      volume_7d: parseFloat(pool.volumeData?.volume7d || "0"),
      // Additional fields for reference
      poolType: pool.poolType,
      tokens: pool.tokens,
      volumeData: pool.volumeData,
      createdAt: pool.createdAt
    }));

    const formattedData = {
      success: true,
      data: transformedPools,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: data.result.data?.length || 0
      }
    };

    return NextResponse.json(formattedData, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
        'Cdn-Cache-Control': 'max-age=30',
        'Surrogate-Control': 'max-age=30'
      }
    });

  } catch (error) {
    console.error("Error fetching Tapp pools:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch Tapp pools",
        data: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0
        }
      },
      { status: 500 }
    );
  }
} 