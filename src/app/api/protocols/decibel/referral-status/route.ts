import { NextResponse } from 'next/server';

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';
const DECIBEL_BUILDER_CODE = process.env.DECIBEL_BUILDER_CODE;

type DecibelReferralCodeResponse = {
  referral_code: string;
  is_valid: boolean;
  is_active: boolean;
};

/**
 * GET /api/protocols/decibel/referral-status
 * Checks if the builder referral code is valid and active (can be used for onboarding).
 * Uses DECIBEL_BUILDER_CODE from env; the code is never exposed to the client.
 * Doc: GET /api/v1/referrals/code/{code}
 */
export async function GET() {
  try {
    if (!DECIBEL_BUILDER_CODE) {
      return NextResponse.json(
        { success: false, error: 'Builder referral code not configured' },
        { status: 503 }
      );
    }
    if (!DECIBEL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Decibel API key not configured' },
        { status: 503 }
      );
    }
    const baseUrl = DECIBEL_API_BASE_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/referrals/code/${encodeURIComponent(DECIBEL_BUILDER_CODE)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${DECIBEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    const text = await response.text();
    let data: DecibelReferralCodeResponse;
    try {
      data = text ? (JSON.parse(text) as DecibelReferralCodeResponse) : ({} as DecibelReferralCodeResponse);
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
    const is_valid = Boolean(data?.is_valid);
    const is_active = Boolean(data?.is_active);
    const canRegister = is_valid && is_active;
    return NextResponse.json({
      success: true,
      canRegister,
      is_valid,
      is_active,
    });
  } catch (error) {
    console.error('[Decibel] referral-status error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
