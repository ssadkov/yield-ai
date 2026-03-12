import { NextRequest, NextResponse } from 'next/server';

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

/**
 * GET /api/public/v1/wallet/{address}/lp
 * Public test endpoint that proxies server-side LP price route.
 * Note: wallet address is validated for API consistency, but not used yet.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    if (isRequireKey()) {
      const key = extractApiKey(request);
      const allowed = getAllowedKeys();
      if (!key || !allowed.has(key)) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    }

    const { address } = await params;
    const norm = normalizeAptosAddress(address);
    if (!norm.ok || !norm.clean) {
      return NextResponse.json({ error: 'invalid_address', address }, { status: 400 });
    }

    const origin = request.nextUrl.origin;
    const upstream = await fetch(`${origin}/api/protocols/moneyfi/lp-price`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            payload && typeof payload === 'object' && 'error' in payload
              ? String((payload as { error: unknown }).error)
              : `upstream_status_${upstream.status}`,
        },
        { status: upstream.status }
      );
    }

    return NextResponse.json(
      {
        address: norm.clean,
        timestamp: new Date().toISOString(),
        ...payload,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'internal_error' },
      { status: 500 }
    );
  }
}

