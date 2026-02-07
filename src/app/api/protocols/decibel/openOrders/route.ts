import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';

/**
 * GET /api/protocols/decibel/openOrders
 * Proxies to Decibel open_orders API. Returns open orders for the account.
 * Doc: GET /api/v1/open_orders?account={address}&pagination[limit]=&pagination[offset]=
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address parameter is required' },
        { status: 400 }
      );
    }
    if (!DECIBEL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Decibel API key not configured' },
        { status: 503 }
      );
    }
    const normalizedAddr = normalizeAddress(address.trim());
    const baseUrl = DECIBEL_API_BASE_URL.replace(/\/$/, '');
    const params = new URLSearchParams({ account: normalizedAddr });
    if (limit != null && limit !== '') params.set('limit', limit);
    if (offset != null && offset !== '') params.set('offset', offset);
    const url = `${baseUrl}/api/v1/open_orders?${params.toString()}`;
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
      data = text ? JSON.parse(text) : { items: [], total_count: 0 };
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
            typeof data === 'object' && data !== null && 'message' in (data as object)
              ? (data as { message: string }).message
              : `Decibel API error: ${response.status}`,
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Decibel] openOrders error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
