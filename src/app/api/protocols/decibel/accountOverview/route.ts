import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';
const DECIBEL_MAINNET_URL = 'https://api.netna.aptoslabs.com/decibel';

/**
 * GET /api/protocols/decibel/accountOverview
 * Proxies to Decibel account_overviews API. Returns balance, margin, equity, PnL for the given Aptos wallet.
 * Query: address (required), includePerformance (optional), volumeWindow (optional), performanceLookbackDays (optional).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const includePerformance = searchParams.get('includePerformance');
    const volumeWindow = searchParams.get('volumeWindow');
    const performanceLookbackDays = searchParams.get('performanceLookbackDays');

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
    // Doc: account_overviews uses "account" (required), not "user"
    const params = new URLSearchParams({ account: normalizedAddr });
    if (includePerformance === 'true') params.set('include_performance', 'true');
    if (volumeWindow) params.set('volume_window', volumeWindow);
    if (performanceLookbackDays) params.set('performance_lookback_days', performanceLookbackDays);
    const url = `${baseUrl}/api/v1/account_overviews?${params.toString()}`;

    console.log('[Decibel] accountOverview request:', { baseUrl, address: normalizedAddr });

    const headers = {
      Authorization: `Bearer ${DECIBEL_API_KEY}`,
      'Content-Type': 'application/json',
    };

    let response = await fetch(url, { method: 'GET', headers });
    let text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok && response.status === 404) {
      const subRes = await fetch(`${baseUrl}/api/v1/subaccounts?owner=${encodeURIComponent(normalizedAddr)}`, { method: 'GET', headers });
      if (subRes.ok) {
        const subText = await subRes.text();
        const subList = subText ? JSON.parse(subText) : [];
        const first = Array.isArray(subList) && subList[0] ? subList[0] : null;
        const tryAddr = first ? (first.subaccount_address || first.primary_account_address) : null;
        if (tryAddr) {
          const paramsSub = new URLSearchParams({ account: String(tryAddr).trim() });
          if (includePerformance === 'true') paramsSub.set('include_performance', 'true');
          if (volumeWindow) paramsSub.set('volume_window', volumeWindow);
          if (performanceLookbackDays) paramsSub.set('performance_lookback_days', performanceLookbackDays);
          console.log('[Decibel] accountOverview 404 for owner, trying subaccount/primary:', tryAddr);
          response = await fetch(`${baseUrl}/api/v1/account_overviews?${paramsSub.toString()}`, { method: 'GET', headers });
          text = await response.text();
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = null;
          }
        }
      }
    }
    if (!response.ok) {
      const tryUserParam = (response.status === 400 || response.status === 404) && url.includes('account=');
      if (tryUserParam) {
        const paramsAlt = new URLSearchParams({ user: normalizedAddr });
        if (includePerformance === 'true') paramsAlt.set('include_performance', 'true');
        if (volumeWindow) paramsAlt.set('volume_window', volumeWindow);
        if (performanceLookbackDays) paramsAlt.set('performance_lookback_days', performanceLookbackDays);
        const urlAlt = `${baseUrl}/api/v1/account_overviews?${paramsAlt.toString()}`;
        console.log('[Decibel] accountOverview retry with user= param');
        response = await fetch(urlAlt, { method: 'GET', headers });
        text = await response.text();
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }
      }
    }

    if (!response.ok) {
      const usedTestnet = baseUrl.includes('testnet');
      if (usedTestnet && !process.env.DECIBEL_API_BASE_URL) {
        const mainnetBase = DECIBEL_MAINNET_URL.replace(/\/$/, '');
        const paramsM = new URLSearchParams({ account: normalizedAddr });
        if (includePerformance === 'true') paramsM.set('include_performance', 'true');
        const urlM = `${mainnetBase}/api/v1/account_overviews?${paramsM.toString()}`;
        console.log('[Decibel] accountOverview trying mainnet');
        const resM = await fetch(urlM, { method: 'GET', headers });
        const textM = await resM.text();
        if (resM.ok && textM) {
          try {
            data = JSON.parse(textM);
            return NextResponse.json({ success: true, data });
          } catch {
            // fall through to error
          }
        }
      }
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

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Decibel] accountOverview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
