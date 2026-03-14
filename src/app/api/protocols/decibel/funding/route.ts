import { NextRequest, NextResponse } from 'next/server';

const EXTERNAL_FUNDING_URL = 'https://yieldai.aoserver.ru/funding.php';

/**
 * GET /api/protocols/decibel/funding
 * - With ?market_name=BTC/USD: 24h weighted average APR (single market).
 * - Without market_name: raw time-series data for all markets (for chart + open interest).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketName = searchParams.get('market_name')?.trim();

    const url = marketName
      ? `${EXTERNAL_FUNDING_URL}?market_name=${encodeURIComponent(marketName)}&weighted_average=true`
      : EXTERNAL_FUNDING_URL;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 }, // cache 5 min on server
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: json?.error || `Upstream returned ${res.status}` },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }
    return NextResponse.json(json);
  } catch (err) {
    console.error('[Decibel funding] proxy error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch funding' },
      { status: 502 }
    );
  }
}
