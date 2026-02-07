import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';
const DECIBEL_MAINNET_URL = 'https://api.netna.aptoslabs.com/decibel';

/**
 * GET /api/protocols/decibel/accountOwnedVaults
 * Proxies to Decibel account_owned_vaults API. Returns vaults created or managed by the account.
 * Query: address (required), offset (optional), limit (optional).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const offset = searchParams.get('offset');
    const limit = searchParams.get('limit');

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    if (!DECIBEL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Decibel API key not configured' },
        { status: 503 }
      );
    }

    const normalizedAddr = normalizeAddress(address.trim());
    const baseUrl = DECIBEL_API_BASE_URL.replace(/\/$/, '');
    const params = new URLSearchParams({ account: normalizedAddr });
    if (offset !== null && offset !== undefined) params.set('offset', offset);
    if (limit !== null && limit !== undefined) params.set('limit', limit);
    const url = `${baseUrl}/api/v1/account_owned_vaults?${params.toString()}`;

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
      data = text ? JSON.parse(text) : [];
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

    let list = Array.isArray(data) ? data : [];
    const usedTestnet = baseUrl.includes('testnet');
    if (list.length === 0 && usedTestnet && !process.env.DECIBEL_API_BASE_URL) {
      const mainnetBase = DECIBEL_MAINNET_URL.replace(/\/$/, '');
      const paramsM = new URLSearchParams({ account: normalizedAddr });
      if (offset != null) paramsM.set('offset', offset);
      if (limit != null) paramsM.set('limit', limit);
      const urlM = `${mainnetBase}/api/v1/account_owned_vaults?${paramsM.toString()}`;
      const resM = await fetch(urlM, {
        method: 'GET',
        headers: { Authorization: `Bearer ${DECIBEL_API_KEY}`, 'Content-Type': 'application/json' },
      });
      if (resM.ok) {
        const textM = await resM.text();
        try {
          const parsed = textM ? JSON.parse(textM) : [];
          list = Array.isArray(parsed) ? parsed : [];
        } catch {
          // keep list
        }
      }
    }
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error('[Decibel] accountOwnedVaults error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
