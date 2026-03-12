import { NextRequest, NextResponse } from 'next/server';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { toCanonicalAddress } from '@/lib/utils/addressNormalization';
import { COIN_BALANCE_VIEW, APTOS_COIN_TYPE } from '@/lib/constants/yieldAiVault';
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
 * GET /api/protocols/yield-ai/safe-contents?safeAddress=0x...
 * Returns FA balances (from Indexer) and APT balance (from coin::balance view) for the safe.
 * Client can attach prices and build Token[].
 */
export async function GET(request: NextRequest) {
  try {
    const safeAddress = request.nextUrl.searchParams.get('safeAddress');
    if (!safeAddress?.trim()) {
      return NextResponse.json(
        createErrorResponse(new Error('safeAddress parameter is required')),
        { status: 400 }
      );
    }
    const address = toCanonicalAddress(safeAddress.trim());

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (APTOS_API_KEY) {
      headers['Authorization'] = `Bearer ${APTOS_API_KEY}`;
    }

    const [indexerRes, aptBalanceResult] = await Promise.all([
      fetch('https://indexer.mainnet.aptoslabs.com/v1/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `
            query GetAccountBalances($address: String!) {
              current_fungible_asset_balances(
                where: {owner_address: {_eq: $address}, amount: {_gt: "0"}}
              ) {
                asset_type
                amount
                last_transaction_timestamp
              }
            }
          `,
          variables: { address },
        }),
      }),
      aptos.view({
        payload: {
          function: COIN_BALANCE_VIEW,
          typeArguments: [APTOS_COIN_TYPE],
          functionArguments: [address],
        },
      }),
    ]);

    const tokens: { asset_type: string; amount: string }[] = [];
    if (indexerRes.ok) {
      const data = await indexerRes.json();
      const balances = data.data?.current_fungible_asset_balances ?? [];
      for (const b of balances) {
        if (b?.asset_type && b?.amount) {
          tokens.push({ asset_type: b.asset_type, amount: String(b.amount) });
        }
      }
    }

    let aptBalance = '0';
    const aptRaw = Array.isArray(aptBalanceResult) ? aptBalanceResult[0] : (aptBalanceResult as any)?.[0];
    if (aptRaw != null && (typeof aptRaw === 'string' || typeof aptRaw === 'number' || typeof aptRaw === 'bigint')) {
      aptBalance = String(aptRaw);
    }

    return NextResponse.json(
      createSuccessResponse({
        tokens,
        aptBalance,
      })
    );
  } catch (error) {
    console.error('[Yield AI] safe-contents error:', error);
    return NextResponse.json(
      createErrorResponse(error instanceof Error ? error : new Error('Unknown error')),
      { status: 500 }
    );
  }
}
