import { NextRequest, NextResponse } from 'next/server';

type ProtocolConfig = {
  key: string;
  endpoint: string;
};

type ProtocolResult = {
  protocol: string;
  endpoint: string;
  success: boolean;
  positionsCount: number;
  positions: unknown[];
  status?: number;
  error?: string;
};

const PROTOCOLS: ProtocolConfig[] = [
  { key: 'hyperion', endpoint: '/api/protocols/hyperion/userPositions' },
  { key: 'echelon', endpoint: '/api/protocols/echelon/userPositions' },
  { key: 'aries', endpoint: '/api/protocols/aries/userPositions' },
  { key: 'joule', endpoint: '/api/protocols/joule/userPositions' },
  { key: 'tapp', endpoint: '/api/protocols/tapp/userPositions' },
  { key: 'meso', endpoint: '/api/protocols/meso/userPositions' },
  { key: 'auro', endpoint: '/api/protocols/auro/userPositions' },
  { key: 'amnis', endpoint: '/api/protocols/amnis/userPositions' },
  { key: 'earnium', endpoint: '/api/protocols/earnium/userPositions' },
  { key: 'aave', endpoint: '/api/protocols/aave/positions' },
  { key: 'moar', endpoint: '/api/protocols/moar/userPositions' },
  { key: 'thala', endpoint: '/api/protocols/thala/userPositions' },
  { key: 'echo', endpoint: '/api/protocols/echo/userPositions' },
  { key: 'decibel', endpoint: '/api/protocols/decibel/userPositions' },
];

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

function extractPositions(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const obj = payload as Record<string, unknown>;

  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.userPositions)) return obj.userPositions;
  if (Array.isArray(obj.positions)) return obj.positions;

  return [];
}

function getPositionsCount(protocolKey: string, positions: unknown[]): number {
  if (protocolKey !== 'joule') {
    return positions.length;
  }

  // Joule may return a scaffold object even when user has no real positions.
  const first = positions[0];
  if (!first || typeof first !== 'object') return 0;

  const obj = first as Record<string, unknown>;
  const positionsMap = obj.positions_map as Record<string, unknown> | undefined;
  const nested = positionsMap?.data;

  if (Array.isArray(nested)) {
    return nested.length;
  }

  return 0;
}

async function fetchProtocolPositions(
  request: NextRequest,
  address: string,
  config: ProtocolConfig
): Promise<ProtocolResult> {
  const origin = request.nextUrl.origin;
  const url = `${origin}${config.endpoint}?address=${encodeURIComponent(address)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const status = response.status;
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : `upstream_status_${status}`;
      return {
        protocol: config.key,
        endpoint: config.endpoint,
        success: false,
        positionsCount: 0,
        positions: [],
        status,
        error: message,
      };
    }

    const positions = extractPositions(payload);
    const positionsCount = getPositionsCount(config.key, positions);
    const normalizedPositions =
      config.key === 'joule' && positionsCount === 0 ? [] : positions;

    return {
      protocol: config.key,
      endpoint: config.endpoint,
      success: true,
      positionsCount,
      positions: normalizedPositions,
      status,
    };
  } catch (error) {
    return {
      protocol: config.key,
      endpoint: config.endpoint,
      success: false,
      positionsCount: 0,
      positions: [],
      error: error instanceof Error ? error.message : 'fetch_failed',
    };
  }
}

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

    const settled = await Promise.all(
      PROTOCOLS.map((protocol) => fetchProtocolPositions(request, norm.clean as string, protocol))
    );

    const protocolsWithPositions = settled.filter((p) => p.positionsCount > 0).length;
    const failedProtocols = settled.filter((p) => !p.success).length;

    return NextResponse.json(
      {
        address: norm.clean,
        timestamp: new Date().toISOString(),
        protocolsTotal: settled.length,
        protocolsWithPositions,
        failedProtocols,
        protocols: settled,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[public wallet protocols] error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
