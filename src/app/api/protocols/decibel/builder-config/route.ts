import { NextResponse } from 'next/server';
import { toCanonicalAddress } from '@/lib/utils/addressNormalization';

/**
 * GET /api/protocols/decibel/builder-config
 * Returns builder address and fee (for Step 2 approve and Step 3 payloads).
 * Used by client to build approve_max_builder_fee and place_order with builder fee.
 */
export async function GET() {
  try {
    const rawAddress = process.env.DECIBEL_BUILDER_ADDRESS;
    const feeBps = process.env.DECIBEL_BUILDER_FEE_BPS;

    if (!rawAddress?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Builder not configured' },
        { status: 503 }
      );
    }

    const builderAddress = toCanonicalAddress(rawAddress.trim());
    const builderFeeBps = feeBps != null && feeBps !== '' ? parseInt(feeBps, 10) : 10;
    if (!Number.isFinite(builderFeeBps) || builderFeeBps < 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid DECIBEL_BUILDER_FEE_BPS' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      builderAddress,
      builderFeeBps,
    });
  } catch (error) {
    console.error('[Decibel] builder-config error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
