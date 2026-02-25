import { NextRequest, NextResponse } from 'next/server';

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';
const DECIBEL_MAINNET_URL = 'https://api.netna.aptoslabs.com/decibel';

/**
 * GET /api/protocols/decibel/prices
 * Proxies to Decibel prices API. Returns current market prices (oracle, mark, mid).
 * Optional ?market=<addr> to filter by market. Omit for all markets.
 * Requires DECIBEL_API_KEY (Bearer token). Optional DECIBEL_API_BASE_URL (default: testnet).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market');

    if (!DECIBEL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Decibel API key not configured' },
        { status: 503 }
      );
    }

    const baseUrl = DECIBEL_API_BASE_URL.replace(/\/$/, '');
    let url = `${baseUrl}/api/v1/prices`;
    if (market && market.trim()) {
      url += `?market=${encodeURIComponent(market.trim())}`;
    }

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
    console.error('[Decibel] prices error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
