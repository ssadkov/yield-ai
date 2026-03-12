import { NextResponse } from 'next/server';

const APTREE_PERFORMANCE_URL = 'https://www.aptree.io/api/earn-pool-performance';

/**
 * GET /api/protocols/aptree/pools
 * Minimal APTree integration for Ideas list.
 */
export async function GET() {
  try {
    const response = await fetch(APTREE_PERFORMANCE_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`APTree API returned ${response.status}`);
    }

    const payload = (await response.json()) as { apy_avg?: number };
    const apyAvg = typeof payload?.apy_avg === 'number' ? payload.apy_avg : 0;

    return NextResponse.json({
      success: true,
      data: [
        {
          pool_id: 'aptree-earn',
          token: 'USDT',
          symbol: 'USDT',
          name: 'USDT',
          tvl: 0,
          apr: apyAvg, // decimal, e.g. 0.12 = 12%
        },
      ],
    });
  } catch (error) {
    console.error('[APTree] pools error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
      },
      { status: 500 }
    );
  }
}
