import { NextResponse } from 'next/server';

const FULLNODE_VIEW_URL = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
const VIEW_PAYLOAD = {
  function:
    '0x951a31b39db54a4e32af927dce9fae7aa1ad14a1bb73318405ccf6cd5d66b3be::moneyfi_adapter::get_lp_price',
  type_arguments: [] as string[],
  arguments: [] as string[],
};

/**
 * GET /api/protocols/moneyfi/lp-price
 * Server-side proxy to Aptos fullnode /v1/view.
 */
export async function GET() {
  try {
    const response = await fetch(FULLNODE_VIEW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(VIEW_PAYLOAD),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);

    return NextResponse.json(
      {
        success: response.ok,
        status: response.status,
        sourceUrl: FULLNODE_VIEW_URL,
        requestPayload: VIEW_PAYLOAD,
        data: payload,
      },
      { status: response.ok ? 200 : response.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

