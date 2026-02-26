import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';

type AmpsResponse = {
  owner: string;
  total_amps: number;
  breakdown: Array<{ subaccount_address?: string; amps?: number }> | null;
};

/**
 * GET /api/protocols/decibel/amps
 * Returns AMPs (points) for a wallet. Data is materialized once per day.
 * Query: owner (or address) - wallet address.
 * Doc: GET /api/v1/points/trading/amps?owner={walletAddress}
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner') ?? searchParams.get('address');
    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Query parameter owner or address is required' },
        { status: 400 }
      );
    }
    if (!DECIBEL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Decibel API key not configured' },
        { status: 503 }
      );
    }
    const normalizedAddr = normalizeAddress(owner.trim());
    const baseUrl = DECIBEL_API_BASE_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/points/trading/amps?owner=${encodeURIComponent(normalizedAddr)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${DECIBEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    const text = await response.text();
    let data: AmpsResponse & { message?: string };
    try {
      data = text ? (JSON.parse(text) as AmpsResponse & { message?: string }) : ({} as AmpsResponse);
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
            typeof data === 'object' && data !== null && 'message' in data
              ? data.message
              : `Decibel API error: ${response.status}`,
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        owner: data.owner ?? normalizedAddr,
        total_amps: typeof data.total_amps === 'number' ? data.total_amps : 0,
        breakdown: data.breakdown ?? null,
      },
    });
  } catch (error) {
    console.error('[Decibel] amps error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
