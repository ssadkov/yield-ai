import { NextRequest, NextResponse } from 'next/server';

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';

const VALID_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1mo'] as const;

/**
 * GET /api/protocols/decibel/candlesticks
 * Proxies to Decibel candlesticks API. Returns OHLCV candles for a market.
 * Query: market (required), interval (required), startTime (required, ms), endTime (required, ms).
 * Requires DECIBEL_API_KEY (Bearer token).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market');
    const interval = searchParams.get('interval');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');

    if (!DECIBEL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Decibel API key not configured' },
        { status: 503 }
      );
    }

    if (!market?.trim()) {
      return NextResponse.json(
        { success: false, error: 'market is required' },
        { status: 400 }
      );
    }
    if (!interval?.trim() || !VALID_INTERVALS.includes(interval.trim() as (typeof VALID_INTERVALS)[number])) {
      return NextResponse.json(
        { success: false, error: 'interval is required and must be one of: 1m, 5m, 15m, 30m, 1h, 2h, 4h, 1d, 1w, 1mo' },
        { status: 400 }
      );
    }
    const startMs = startTime?.trim() ? Number(startTime.trim()) : NaN;
    const endMs = endTime?.trim() ? Number(endTime.trim()) : NaN;
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) {
      return NextResponse.json(
        { success: false, error: 'startTime and endTime are required (Unix ms) and startTime must be less than endTime' },
        { status: 400 }
      );
    }

    const baseUrl = DECIBEL_API_BASE_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/candlesticks?market=${encodeURIComponent(market.trim())}&interval=${encodeURIComponent(interval.trim())}&startTime=${startMs}&endTime=${endMs}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${DECIBEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : [];
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid response from Decibel API' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            typeof data === 'object' &&
            data !== null &&
            'message' in (data as object)
              ? (data as { message: string }).message
              : `Decibel API error: ${response.status}`,
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    const list = Array.isArray(data) ? data : [data];
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error('[Decibel] candlesticks error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
