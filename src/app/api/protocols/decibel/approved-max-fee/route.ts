import { NextRequest, NextResponse } from 'next/server';
import { toCanonicalAddress } from '@/lib/utils/addressNormalization';
import { PACKAGE_MAINNET, PACKAGE_TESTNET } from '@/lib/protocols/decibel/closePosition';

const FULLNODE_VIEW_URL_MAINNET = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
const FULLNODE_VIEW_URL_TESTNET = 'https://fullnode.testnet.aptoslabs.com/v1/view';

/**
 * GET /api/protocols/decibel/approved-max-fee
 * Checks whether the Decibel subaccount has approved a builder fee (on-chain view get_approved_max_fee).
 * subaccount = Decibel subaccount address (the trading account, not the owner wallet).
 * builder = builder address (optional; defaults to DECIBEL_BUILDER_ADDRESS env).
 *
 * Returns: { approvedMaxFeeBps: number | null }
 * - null when Option::None (no approval for that subaccount/builder pair).
 * - number when approved (max fee in basis points).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subaccountParam = searchParams.get('subaccount') ?? searchParams.get('user');
    const builderParam = searchParams.get('builder');
    const isTestnet = searchParams.get('network') === 'testnet';

    if (!subaccountParam?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "subaccount" is required (Decibel subaccount address)' },
        { status: 400 }
      );
    }

    const subaccount = toCanonicalAddress(subaccountParam.trim());
    let builder: string;

    if (builderParam?.trim()) {
      builder = toCanonicalAddress(builderParam.trim());
    } else {
      const envBuilder = process.env.DECIBEL_BUILDER_ADDRESS?.trim();
      if (!envBuilder) {
        return NextResponse.json(
          { success: false, error: 'Builder address required: set "builder" query param or DECIBEL_BUILDER_ADDRESS' },
          { status: 400 }
        );
      }
      builder = toCanonicalAddress(envBuilder);
    }

    const pkg = isTestnet ? PACKAGE_TESTNET : PACKAGE_MAINNET;
    const viewUrl = isTestnet ? FULLNODE_VIEW_URL_TESTNET : FULLNODE_VIEW_URL_MAINNET;
    const functionName = `${pkg}::builder_code_registry::get_approved_max_fee`;

    const viewPayload = {
      function: functionName,
      type_arguments: [] as string[],
      arguments: [subaccount, builder],
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.APTOS_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.APTOS_API_KEY}`;
    }

    const res = await fetch(viewUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(viewPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[Decibel] approved-max-fee view error:', res.status, text);
      return NextResponse.json(
        {
          success: false,
          error: `View failed: ${res.status}`,
          details: text.slice(0, 200),
        },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    const raw = await res.json();
    // View returns one value: Option<u64> -> JSON is either {"vec":[]} (None) or {"vec":["123"]} (Some(123))
    const first = Array.isArray(raw) ? raw[0] : raw;
    let approvedMaxFeeBps: number | null = null;

    if (first && typeof first === 'object' && 'vec' in first && Array.isArray(first.vec) && first.vec.length > 0) {
      const val = first.vec[0];
      const parsed = typeof val === 'string' ? parseInt(val, 10) : Number(val);
      if (Number.isFinite(parsed)) {
        approvedMaxFeeBps = parsed;
      }
    }

    return NextResponse.json({
      success: true,
      approvedMaxFeeBps,
      subaccount,
      builder,
    });
  } catch (error) {
    console.error('[Decibel] approved-max-fee error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
