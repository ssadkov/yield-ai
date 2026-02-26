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

    const fetchOptions = {
      method: 'POST' as const,
      headers: {
        Authorization: `Bearer ${DECIBEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        referral_code: DECIBEL_BUILDER_CODE,
        account: account64,
      }),
    };

    const fetchWithTimeout = (timeoutMs: number) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      return fetch(url, { ...fetchOptions, signal: controller.signal }).finally(() => clearTimeout(id));
    };

    const timeoutMs = 25000;
    let response: Response;
    try {
      response = await fetchWithTimeout(timeoutMs);
    } catch (fetchErr) {
      try {
        response = await fetchWithTimeout(timeoutMs);
      } catch (retryErr) {
        const err = retryErr ?? fetchErr;
        const isTimeout =
          err instanceof Error && (err.name === 'AbortError' || (err as { cause?: { code?: string } }).cause?.code === 'UND_ERR_CONNECT_TIMEOUT');
        console.error('[Decibel] onboard fetch failed:', err);
        return NextResponse.json(
          {
            success: false,
            error: isTimeout
              ? 'Connection to Decibel timed out. Please try again.'
              : err instanceof Error ? err.message : 'Failed to reach Decibel API',
          },
          { status: 502 }
        );
      }
    }
    const text = await response.text();
    let data: Partial<DecibelRedeemResponse> & { message?: string };
    try {
      data = text ? (JSON.parse(text) as DecibelRedeemResponse & { message?: string }) : {};
    } catch {
      const snippet = (text || '').slice(0, 200).replace(/\s+/g, ' ').trim();
      console.error('[Decibel] onboard: non-JSON response', response.status, snippet);
      if (response.status === 403 && /internal only/i.test(snippet)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Redeem is restricted to Decibel internal use. Please register at app.decibel.trade',
            code: 'DECIBEL_REDEEM_FORBIDDEN',
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error:
            response.status >= 400
              ? `Decibel API returned ${response.status}. ${snippet || 'Non-JSON response.'}`
              : 'Invalid response from Decibel API',
        },
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
    if (typeof data.account !== 'string' || typeof data.referral_code !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid response payload from Decibel API',
        },
        { status: 502 }
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
