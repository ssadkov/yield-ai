import { NextRequest, NextResponse } from 'next/server';
import { getWalletBalance } from '@/lib/services/wallet-api';

function isRequireKey(): boolean {
  const flag = process.env.PUBLIC_API_REQUIRE_KEY;
  return flag === 'true' || flag === '1';
}

function getAllowedKeys(): Set<string> {
  const raw = process.env.PUBLIC_API_KEYS || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function extractApiKey(req: NextRequest): string | null {
  const headerKey = req.headers.get('x-api-key');
  if (headerKey) return headerKey;
  const keyFromQuery = req.nextUrl.searchParams.get('api_key');
  return keyFromQuery || null;
}

function normalizeAptosAddress(input: string): { ok: boolean; clean?: string; provided: string } {
  const provided = input;
  const no0x = input.startsWith('0x') ? input.slice(2) : input;
  const isHex64 = /^[0-9a-fA-F]{64}$/.test(no0x);
  if (!isHex64) return { ok: false, provided };
  return { ok: true, clean: '0x' + no0x.toLowerCase(), provided };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    // API key (optional, controlled by env)
    if (isRequireKey()) {
      const key = extractApiKey(request);
      const allowed = getAllowedKeys();
      if (!key || !allowed.has(key)) {
        return NextResponse.json(
          { error: 'unauthorized' },
          { status: 401 }
        );
      }
    }

    // Params (Next.js 15: must await)
    const { address } = await params;

    // Validate and normalize address
    const norm = normalizeAptosAddress(address);
    if (!norm.ok || !norm.clean) {
      return NextResponse.json(
        { error: 'invalid_address', address },
        { status: 400 }
      );
    }

    // Aggregate
    const result = await getWalletBalance(norm.clean);

    // Ensure sorting and total sum
    const tokensSorted = (result.tokens || []).slice().sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0));

    // Map to external schema and filter out invalid tokens
    const tokens = tokensSorted
      .filter((t) => {
        // Filter out tokens with invalid balance
        if (!t.balance || t.balance === 'NaN' || t.balance === 'undefined' || t.balance === 'null') {
          return false;
        }
        
        // Check if balance is actually a number
        const balanceNum = parseFloat(t.balance);
        if (isNaN(balanceNum)) {
          return false;
        }
        
        return true;
      })
      .map((t) => ({
        tokenAddress: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        amount: t.balance,
        priceUSD: t.priceUSD,
        valueUSD: t.valueUSD,
      }));

    const payload = {
      address: norm.clean,
      timestamp: new Date().toISOString(),
      tokens,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error('[public wallet balance] error:', error);
    return NextResponse.json(
      { error: 'internal_error' },
      { status: 500 }
    );
  }
}
