import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';

/**
 * GET /api/protocols/decibel/predepositHistory
 * Proxies to Decibel predeposits/history API.
 * Doc: https://docs.decibel.trade/api-reference/predeposit-points/get-predeposit-balance-event-history-for-a-user
 *
 * Query: address (required), kind (optional: deposit|withdraw|promote), fund_type (optional: 0=DLP, 1=UA),
 * startTime (optional, ms), endTime (optional, ms), limit (optional), offset (optional).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const kind = searchParams.get('kind');
    const fundType = searchParams.get('fund_type');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
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
    if (kind != null && kind !== '') params.set('kind', kind);
    if (fundType != null && fundType !== '') params.set('fund_type', fundType);
    if (startTime != null && startTime !== '') params.set('startTime', startTime);
    if (endTime != null && endTime !== '') params.set('endTime', endTime);
    if (limit != null && limit !== '') params.set('limit', limit);
    if (offset != null && offset !== '') params.set('offset', offset);

    const url = `${baseUrl}/api/v1/predeposits/history?${params.toString()}`;

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
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
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
    console.error('[Decibel] predepositHistory error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
