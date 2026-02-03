import { NextRequest, NextResponse } from 'next/server';
import { getReserveApyMetrics, EchoReserveData } from '@/lib/utils/apy';

const ECHO_CONTRACT = '0xeab7ea4d635b6b6add79d5045c4a45d8148d88287b1cfa1c3b6a4b56f46839ed';
const FULLNODE_VIEW_URL = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
const APTOS_API_KEY = process.env.APTOS_API_KEY;

function normalizeTokenAddress(address: string): string {
  if (!address) return '';
  const prefixed = address.startsWith('0x') ? address : `0x${address}`;
  const normalized = `0x${prefixed.slice(2).replace(/^0+/, '') || '0'}`;
  return normalized;
}

async function callView(functionFullname: string, args: string[]): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (APTOS_API_KEY) {
    headers.Authorization = `Bearer ${APTOS_API_KEY}`;
  }

  const res = await fetch(FULLNODE_VIEW_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      function: functionFullname,
      type_arguments: [],
      arguments: args,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Echo view error: ${res.status} ${text}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function parseReserveData(result: unknown): EchoReserveData {
  if (!result) return {};

  if (Array.isArray(result)) {
    if (result.length === 0) return {};
    if (result.length === 1 && typeof result[0] === 'object' && result[0] !== null) {
      return result[0] as EchoReserveData;
    }
    return result[0] as EchoReserveData;
  }

  if (typeof result === 'object') {
    return result as EchoReserveData;
  }

  return {};
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const underlyingParam =
      searchParams.get('underlyingAddress') ||
      searchParams.get('address') ||
      searchParams.get('token');

    if (!underlyingParam) {
      return NextResponse.json({ error: 'underlyingAddress parameter is required' }, { status: 400 });
    }

    const underlyingAddress = normalizeTokenAddress(underlyingParam);
    if (!underlyingAddress || underlyingAddress === '0x') {
      return NextResponse.json({ error: 'Invalid underlyingAddress parameter' }, { status: 400 });
    }

    const reserveDataRaw = await callView(
      `${ECHO_CONTRACT}::pool::get_reserve_data`,
      [underlyingAddress],
    );
    const reserveData = parseReserveData(reserveDataRaw);
    const metrics = getReserveApyMetrics(reserveData);

    return NextResponse.json(
      {
        success: true,
        data: {
          underlyingAddress,
          supplyApy: metrics.supplyApy,
          borrowApy: metrics.borrowApy,
          supplyApyFormatted: metrics.supplyApyFormatted,
          borrowApyFormatted: metrics.borrowApyFormatted,
          raw: reserveData,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=10, s-maxage=10, stale-while-revalidate=30',
        },
      },
    );
  } catch (error) {
    console.error('[Echo] reserveApy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

