import { NextRequest, NextResponse } from 'next/server';
import { toCanonicalAddress } from '@/lib/utils/addressNormalization';

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';

type ReferrerStatsResponse = {
  referrer_account: string;
  total_referrals: number;
  total_codes_created: number;
  is_affiliate: number;
  codes: string[];
};

/**
 * GET /api/protocols/decibel/referrerStats
 * Proxies to Decibel referrer statistics API. Returns referral counts for the given account.
 * Query: address (required).
 * Doc: https://docs.decibel.trade/api-reference/referrals/handler-to-get-referrer-statistics
 * GET /api/v1/referrals/stats/{account}
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

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

    const decibelAddr = toCanonicalAddress(address.trim());
    const baseUrl = DECIBEL_API_BASE_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/referrals/stats/${encodeURIComponent(decibelAddr)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${DECIBEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    let data: Partial<ReferrerStatsResponse> & { message?: string };
    try {
      data = text ? (JSON.parse(text) as ReferrerStatsResponse & { message?: string }) : {};
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
        referrer_account: data.referrer_account ?? decibelAddr,
        total_referrals: typeof data.total_referrals === 'number' ? data.total_referrals : 0,
        total_codes_created: typeof data.total_codes_created === 'number' ? data.total_codes_created : 0,
        is_affiliate: typeof data.is_affiliate === 'number' ? data.is_affiliate : 0,
        codes: Array.isArray(data.codes) ? data.codes : [],
      },
    });
  } catch (error) {
    console.error('[Decibel] referrerStats error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
