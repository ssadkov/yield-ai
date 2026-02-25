import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';
const DECIBEL_BUILDER_CODE = process.env.DECIBEL_BUILDER_CODE;

type DecibelRedeemResponse = {
  referral_code: string;
  account: string;
  generated_referral_codes?: string[];
};

/** Pad address to 64 hex chars after 0x (Decibel expects this format). */
function to64Hex(addr: string): string {
  const s = addr.startsWith('0x') ? addr.slice(2) : addr;
  const hex = s.replace(/^0+/, '') || '0';
  return '0x' + hex.padStart(64, '0').slice(-64);
}

/**
 * POST /api/protocols/decibel/onboard
 * Creates a Decibel subaccount for the user by redeeming the builder referral code.
 * Body: { account: string } (wallet address, 0x-prefixed).
 * Uses DECIBEL_BUILDER_CODE from env; the code is never sent to the client.
 * Doc: POST /api/v1/referrals/redeem
 * Idempotent: calling again with same account returns 409 (already onboarded); treat as success.
 */
export async function POST(request: NextRequest) {
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
    let body: { account?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
    const account = body?.account?.trim();
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Body must include account (wallet address)' },
        { status: 400 }
      );
    }
    const normalizedAddr = normalizeAddress(account);
    const account64 = to64Hex(normalizedAddr);
    const baseUrl = DECIBEL_API_BASE_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/referrals/redeem`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DECIBEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        referral_code: DECIBEL_BUILDER_CODE,
        account: account64,
      }),
    });
    const text = await response.text();
    let data: DecibelRedeemResponse & { message?: string };
    try {
      data = text ? (JSON.parse(text) as DecibelRedeemResponse & { message?: string }) : {};
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid response from Decibel API' },
        { status: 502 }
      );
    }
    if (response.status === 409) {
      return NextResponse.json({
        success: true,
        alreadyOnboarded: true,
        message: 'User already has a subaccount',
      });
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
      account: data.account,
      referral_code: data.referral_code,
      generated_referral_codes: data.generated_referral_codes ?? [],
    });
  } catch (error) {
    console.error('[Decibel] onboard error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
