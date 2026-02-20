import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';
import { deriveVaultApr } from '@/lib/protocols/decibel/vaultApr';

type AccountVaultPerfItem = { vault?: unknown } & Record<string, unknown>;

const DECIBEL_API_KEY = process.env.DECIBEL_API_KEY;
const DECIBEL_API_BASE_URL =
  process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel';
const DECIBEL_MAINNET_URL = 'https://api.netna.aptoslabs.com/decibel';

/**
 * GET /api/protocols/decibel/accountVaultPerformance
 * Proxies to Decibel account_vault_performance API. Returns performance for all vaults where the account has deposits.
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
    const headers = {
      Authorization: `Bearer ${DECIBEL_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const fetchVaultPerf = async (account: string): Promise<AccountVaultPerfItem[]> => {
      const params = new URLSearchParams({ account });
      if (offset !== null && offset !== undefined) params.set('offset', offset);
      if (limit !== null && limit !== undefined) params.set('limit', limit);
      const url = `${baseUrl}/api/v1/account_vault_performance?${params.toString()}`;
      const res = await fetch(url, { method: 'GET', headers });
      const text = await res.text();
      if (!res.ok) return [];
      try {
        const parsed = text ? JSON.parse(text) : [];
        return Array.isArray(parsed) ? (parsed as AccountVaultPerfItem[]) : [];
      } catch {
        return [];
      }
    };

    let list: AccountVaultPerfItem[] = await fetchVaultPerf(normalizedAddr);

    if (list.length === 0) {
      const subRes = await fetch(
        `${baseUrl}/api/v1/subaccounts?owner=${encodeURIComponent(normalizedAddr)}`,
        { method: 'GET', headers }
      );
      if (subRes.ok) {
        const subText = await subRes.text();
        let subaccounts: { subaccount_address?: string }[] = [];
        try {
          const parsed = subText ? JSON.parse(subText) : [];
          subaccounts = Array.isArray(parsed) ? parsed : [];
        } catch {
          // ignore
        }
        for (const sub of subaccounts) {
          const subAddr = sub.subaccount_address;
          if (!subAddr) continue;
          const subList = await fetchVaultPerf(subAddr);
          const seen = new Set(list.map((v) => ((v.vault as { id?: string } | undefined)?.id ?? '')));
          for (const v of subList) {
            const id = (v.vault as { id?: string } | undefined)?.id ?? '';
            if (id && !seen.has(id)) {
              seen.add(id);
              list.push(v);
            } else if (!id) list.push(v);
          }
        }
      }
    }

    const usedTestnet = baseUrl.includes('testnet');
    if (list.length === 0 && usedTestnet && !process.env.DECIBEL_API_BASE_URL) {
      const mainnetBase = DECIBEL_MAINNET_URL.replace(/\/$/, '');
      const paramsM = new URLSearchParams({ account: normalizedAddr });
      if (offset != null) paramsM.set('offset', offset);
      if (limit != null) paramsM.set('limit', limit);
      const urlM = `${mainnetBase}/api/v1/account_vault_performance?${paramsM.toString()}`;
      const resM = await fetch(urlM, { method: 'GET', headers });
      if (resM.ok) {
        const textM = await resM.text();
        try {
          const parsed = textM ? JSON.parse(textM) : [];
          list = Array.isArray(parsed) ? (parsed as AccountVaultPerfItem[]) : [];
        } catch {
          // keep list
        }
      }
    }

    // Enrich each item with derived APR when vault has return metrics but no apr field
    const enriched = list.map((item) => {
      const apr = deriveVaultApr(item.vault as Parameters<typeof deriveVaultApr>[0]);
      return { ...item, apr: apr ?? undefined };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[Decibel] accountVaultPerformance error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
