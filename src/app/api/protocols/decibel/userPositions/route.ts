import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';
const DECIBEL_MAINNET_URL = 'https://api.netna.aptoslabs.com/decibel';

/**
 * GET /api/protocols/decibel/userPositions
 * Proxies to Decibel account_positions API. Returns open positions for the given Aptos wallet.
 * Requires DECIBEL_API_KEY (Bearer token). Optional DECIBEL_API_BASE_URL (default: testnet).
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

    if (!DECIBEL_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Decibel API key not configured' },
        { status: 503 }
      );
    }

    const normalizedAddr = normalizeAddress(address.trim());
    const baseUrl = DECIBEL_API_BASE_URL.replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/account_positions?account=${encodeURIComponent(normalizedAddr)}`;

    console.log('[Decibel] userPositions request:', { baseUrl, address: normalizedAddr, urlNoQuery: `${baseUrl}/api/v1/account_positions` });

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
      console.error('[Decibel] userPositions invalid JSON:', text?.slice(0, 200));
      return NextResponse.json(
        { success: false, error: 'Invalid response from Decibel API' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.warn('[Decibel] userPositions API error:', response.status, data);
      return NextResponse.json(
        { success: false, error: typeof data === 'object' && data !== null && 'message' in (data as object) ? (data as { message: string }).message : `Decibel API error: ${response.status}` },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    let positions: any[] = Array.isArray(data) ? data : [];
    const headers = {
      Authorization: `Bearer ${DECIBEL_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const seen = new Set<string>();
    for (const p of positions) {
      seen.add(`${p.market}-${p.user}-${p.size}-${p.entry_price}`);
    }
    const subaccountsUrl = `${baseUrl}/api/v1/subaccounts?owner=${encodeURIComponent(normalizedAddr)}`;
    try {
      const subRes = await fetch(subaccountsUrl, { method: 'GET', headers });
      if (subRes.ok) {
        const subText = await subRes.text();
        const subList = subText ? JSON.parse(subText) : [];
        if (Array.isArray(subList)) {
          for (const s of subList) {
            const acc = s.subaccount_address ? String(s.subaccount_address).trim() : null;
            if (!acc || acc === normalizedAddr) continue;
            const posUrl = `${baseUrl}/api/v1/account_positions?account=${encodeURIComponent(acc)}`;
            const posRes = await fetch(posUrl, { method: 'GET', headers });
            if (posRes.ok) {
              const posText = await posRes.text();
              const arr = posText ? JSON.parse(posText) : [];
              if (Array.isArray(arr)) {
                for (const p of arr) {
                  const key = `${p.market}-${p.user}-${p.size}-${p.entry_price}`;
                  if (seen.has(key)) continue;
                  seen.add(key);
                  positions.push(p);
                }
              }
            }
          }
        }
        console.log('[Decibel] userPositions after subaccounts:', { subaccounts: Array.isArray(subList) ? subList.length : 0, count: positions.length });
      }
    } catch (e) {
      console.warn('[Decibel] userPositions subaccounts fetch failed:', e);
    }

    const usedTestnet = baseUrl.includes('testnet');
    if (positions.length === 0 && usedTestnet && !process.env.DECIBEL_API_BASE_URL) {
      const mainnetUrl = `${DECIBEL_MAINNET_URL.replace(/\/$/, '')}/api/v1/account_positions?account=${encodeURIComponent(normalizedAddr)}`;
      console.log('[Decibel] userPositions empty on testnet, trying mainnet');
      const mainnetRes = await fetch(mainnetUrl, { method: 'GET', headers });
      const mainnetText = await mainnetRes.text();
      if (mainnetRes.ok && mainnetText) {
        try {
          const mainnetData = JSON.parse(mainnetText);
          positions = Array.isArray(mainnetData) ? mainnetData : [];
          console.log('[Decibel] userPositions mainnet response:', { status: mainnetRes.status, count: positions.length });
        } catch {
          // ignore parse error, keep []
        }
      }
    }
    return NextResponse.json({ success: true, data: positions });
  } catch (error) {
    console.error('[Decibel] userPositions error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
