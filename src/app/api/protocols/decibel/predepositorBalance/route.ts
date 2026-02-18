import { NextRequest, NextResponse } from 'next/server';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { normalizeAddress } from '@/lib/utils/addressNormalization';

// Decibel predeposit module (mainnet)
const PREDEPOSIT_MODULE = '0xc5939ec6e7e656cb6fed9afa155e390eb2aa63ba74e73157161829b2f80e1538';
// Decibel pool address (hardcoded for now)
const POOL_ADDRESS = '0xbd0c23dbc2e9ac041f5829f79b4c4c1361ddfa2125d5072a96b817984a013d69';

const APTOS_API_KEY = process.env.APTOS_API_KEY;

const config = new AptosConfig({
  network: Network.MAINNET,
  ...(APTOS_API_KEY && {
    clientConfig: {
      HEADERS: {
        Authorization: `Bearer ${APTOS_API_KEY}`,
      },
    },
  }),
});
const aptos = new Aptos(config);

/**
 * GET /api/protocols/decibel/predepositorBalance
 * Calls mainnet view predeposit::predepositor_balance(pool, user).
 * Returns amounts in USDC base units (6 decimals) and sumUsdc.
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

    const normalizedAddr = normalizeAddress(address.trim());

    const result = await aptos.view({
      payload: {
        function: `${PREDEPOSIT_MODULE}::predeposit::predepositor_balance`,
        typeArguments: [],
        functionArguments: [POOL_ADDRESS, normalizedAddr],
      },
    });

    const raw = Array.isArray(result) ? result : [];
    const amounts: number[] = raw.map((v) => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') return parseInt(v, 10) || 0;
      if (typeof v === 'bigint') return Number(v);
      return 0;
    });
    const sumRaw = amounts.reduce((a, b) => a + b, 0);
    const sumUsdc = sumRaw / 1e6;

    return NextResponse.json({
      success: true,
      data: { amounts, sumUsdc },
    });
  } catch (error) {
    console.error('[Decibel] predepositorBalance error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
