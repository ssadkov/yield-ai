import { NextRequest, NextResponse } from 'next/server';
import { deriveVaultApr } from '@/lib/protocols/decibel/vaultApr';

type DecibelPublicVaultItem = Record<string, unknown>;

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';

/**
 * GET /api/protocols/decibel/vaults
 * Proxies to Decibel public vaults API (GET /api/v1/vaults).
 * Query: limit (optional), offset (optional), status (optional), vault_type (optional), vault_address (optional), search (optional).
 * Response items are enriched with derived apr (decimal) since the API does not return apr for public vaults.
 * @see https://docs.decibel.trade/api-reference/vaults/get-public-vaults
 */
export async function GET(request: NextRequest) {
  try {
    if (!DECIBEL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Decibel API key not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const status = searchParams.get('status');
    const vaultType = searchParams.get('vault_type');
    const vaultAddress = searchParams.get('vault_address');
    const search = searchParams.get('search');

    const baseUrl = DECIBEL_API_BASE_URL.replace(/\/$/, '');
    const params = new URLSearchParams();
    params.set('limit', limit != null && limit !== '' ? limit : '50');
    params.set('offset', offset != null && offset !== '' ? offset : '0');
    if (status != null && status !== '') params.set('status', status);
    if (vaultType != null && vaultType !== '') params.set('vault_type', vaultType);
    if (vaultAddress != null && vaultAddress !== '') params.set('vault_address', vaultAddress);
    if (search != null && search !== '') params.set('search', search);

    const url = `${baseUrl}/api/v1/vaults?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${DECIBEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid response from Decibel API' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            typeof data === 'object' && data !== null && 'message' in (data as object)
              ? (data as { message: string }).message
              : `Decibel API error: ${response.status}`,
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    const raw = data as {
      items?: DecibelPublicVaultItem[];
      total_count?: number;
      total_value_locked?: number;
      total_volume?: number;
    };

    const items: DecibelPublicVaultItem[] = Array.isArray(raw?.items) ? raw.items : [];
    const enriched = items.map((item) => {
      const apr = deriveVaultApr(item as Parameters<typeof deriveVaultApr>[0]);
      return { ...item, apr: apr ?? undefined };
    });

    return NextResponse.json({
      success: true,
      data: {
        items: enriched,
        total_count: raw?.total_count ?? items.length,
        total_value_locked: raw?.total_value_locked,
        total_volume: raw?.total_volume,
      },
    });
  } catch (error) {
    console.error('[Decibel] vaults error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
