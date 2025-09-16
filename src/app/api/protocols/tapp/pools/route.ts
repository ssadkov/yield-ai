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

    // If specific page is requested, return that page only
    if (page !== "1") {
      return await fetchSinglePage(chain, parseInt(page), parseInt(limit));
    }

    // For page 1, fetch ALL pages to get all pools
    console.log('Fetching ALL Tapp pools pages...');
    
    const allPools: any[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    let totalPools = 0;

    while (hasMorePages) {
      console.log(`Fetching page ${currentPage}...`);
      
      const pageData = await fetchSinglePage(chain, currentPage, parseInt(limit));
      const pageResponse = await pageData.json();
      
      if (pageResponse.success && pageResponse.data && pageResponse.data.length > 0) {
        allPools.push(...pageResponse.data);
        totalPools = pageResponse.pagination?.total || 0;
        
        // Check if we have more pages
        const currentPageSize = pageResponse.data.length;
        console.log(`Page ${currentPage}: ${currentPageSize} pools, total so far: ${allPools.length}, total available: ${totalPools}`);
        
        // Stop if we got fewer pools than requested (last page)
        // Don't rely on total from API as it seems incorrect
        hasMorePages = currentPageSize === parseInt(limit);
        currentPage++;
        
        // Safety check to prevent infinite loops
        if (currentPage > 10) {
          console.log('Safety limit reached, stopping pagination');
          hasMorePages = false;
        }
      } else {
        console.log(`No more data on page ${currentPage}, stopping pagination`);
        hasMorePages = false;
      }
    }

    console.log(`Total pools loaded: ${allPools.length}`);

    const formattedData = {
      success: true,
      data: allPools,
      pagination: {
        page: 1,
        limit: allPools.length,
        total: allPools.length
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

async function fetchSinglePage(chain: string, page: number, limit: number) {
  const tappApiUrl = "https://api.tapp.exchange/api/v1";
  const requestBody = {
    method: "public/pool",
    jsonrpc: "2.0",
    id: 4,
    params: {
      query: {
        chain: chain,
        page: page,
        pageSize: limit
      }
    }
  };

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

  // Check if we have valid data (JSON-RPC format)
  if (!data.result || !data.result.data) {
    console.log(`No valid pools data on page ${page}`);
    return NextResponse.json({
      success: true,
      data: [],
      pagination: {
        page: page,
        limit: limit,
        total: 0
      }
    });
  }

  // Log pool token counts for debugging
  const tokenCounts = data.result.data.reduce((acc: any, pool: any) => {
    const count = pool.tokens?.length || 0;
    acc[count] = (acc[count] || 0) + 1;
    return acc;
  }, {});
  console.log('Tapp pools by token count:', tokenCounts);
  
  // Log pools with 3+ tokens
  const multiTokenPools = data.result.data.filter((pool: any) => (pool.tokens?.length || 0) >= 3);
  if (multiTokenPools.length > 0) {
    console.log('Multi-token pools found:', multiTokenPools.map((p: any) => ({
      id: p.poolId,
      symbols: p.tokens?.map((t: any) => t.symbol)
    })));
  }

  // Transform the data to match our expected format
  const transformedPools = data.result.data.map((pool: any) => {
    return {
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
    };
  });

  return NextResponse.json({
    success: true,
    data: transformedPools,
    pagination: data.result.pagination || {
      page: page,
      limit: limit,
      total: transformedPools.length
    }
  });
} 