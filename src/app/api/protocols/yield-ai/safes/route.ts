import { NextRequest, NextResponse } from 'next/server';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { toCanonicalAddress } from '@/lib/utils/addressNormalization';
import { YIELD_AI_VAULT_MODULE, VAULT_VIEW } from '@/lib/constants/yieldAiVault';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';

const APTOS_API_KEY = process.env.APTOS_API_KEY;
const config = new AptosConfig({
  network: Network.MAINNET,
  ...(APTOS_API_KEY && {
    clientConfig: {
      HEADERS: { Authorization: `Bearer ${APTOS_API_KEY}` },
    },
  }),
});
const aptos = new Aptos(config);

/**
 * GET /api/protocols/yield-ai/safes?owner=0x...
 * Returns list of safe object addresses for the given owner.
 * Uses vault view: safe_ref_exists, get_safe_count, get_safe_address(owner, i).
 */
export async function GET(request: NextRequest) {
  try {
    const owner = request.nextUrl.searchParams.get('owner');
    if (!owner?.trim()) {
      return NextResponse.json(
        createErrorResponse(new Error('owner parameter is required')),
        { status: 400 }
      );
    }
    const ownerAddr = toCanonicalAddress(owner.trim());

    const existsResult = await aptos.view({
      payload: {
        function: VAULT_VIEW.safeRefExists,
        typeArguments: [],
        functionArguments: [ownerAddr],
      },
    });
    const exists = Array.isArray(existsResult) && existsResult[0] === true;
    if (!exists) {
      return NextResponse.json(createSuccessResponse({ safeAddresses: [] }));
    }

    const countResult = await aptos.view({
      payload: {
        function: `${YIELD_AI_VAULT_MODULE}::get_safe_count`,
        typeArguments: [],
        functionArguments: [ownerAddr],
      },
    });
    const count = Array.isArray(countResult) && typeof countResult[0] === 'number'
      ? (countResult[0] as number)
      : Number(countResult?.[0]) || 0;
    if (count <= 0) {
      return NextResponse.json(createSuccessResponse({ safeAddresses: [] }));
    }

    const safeAddresses: string[] = [];
    for (let i = 0; i < count; i++) {
      const addrResult = await aptos.view({
        payload: {
          function: VAULT_VIEW.getSafeAddress,
          typeArguments: [],
          functionArguments: [ownerAddr, i],
        },
      });
      const addr = Array.isArray(addrResult) ? addrResult[0] : (addrResult as any)?.[0];
      if (addr != null && typeof addr === 'string') {
        safeAddresses.push(addr);
      }
    }

    return NextResponse.json(createSuccessResponse({ safeAddresses }));
  } catch (error) {
    console.error('[Yield AI] safes error:', error);
    return NextResponse.json(
      createErrorResponse(error instanceof Error ? error : new Error('Unknown error')),
      { status: 500 }
    );
  }
}
