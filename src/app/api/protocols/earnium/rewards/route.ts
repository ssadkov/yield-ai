import { NextRequest, NextResponse } from 'next/server';
import tokenList from '@/lib/data/tokenList.json';

const FULLNODE_VIEW_URL = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
const EARNIUM_PACKAGE = '0x7c92a9636a412407aaede35eb2654d176477c00a47bc11ea3338d1f571ec95bc';
// New single-call view: returns an array of per-pool objects { rewards: { data: [...] }, staked, unlock_time, wallet_balance }
const VIEW_FUNCTION = `${EARNIUM_PACKAGE}::premium_staked_pool::user_info`;

interface RewardEntry {
  key: { inner: string };
  value: string; // amount in smallest units
}

interface TokenMeta {
  symbol: string;
  decimals: number;
  logoUrl?: string | null;
}

const KNOWN_TOKEN_META: Record<string, TokenMeta> = {
  // USE token
  '0xcd94610565e131c1d8507ed46fccc6d0b64304fc2946fbfceb4420922d7d8b24': {
    symbol: 'USE',
    decimals: 8,
    logoUrl: 'https://img.earnium.io/USE.png'
  }
};

function normalizeHex(addr: string): string {
  const a = addr?.toLowerCase() || '';
  return a.startsWith('0x') ? a : `0x${a}`;
}

function findTokenMetaFromList(address: string): TokenMeta | null {
  const clean = normalizeHex(address);
  const tokens = (tokenList as any).data?.data || [];
  const found = tokens.find((t: any) => {
    const fa = t.faAddress ? normalizeHex(t.faAddress) : null;
    const coin = t.tokenAddress ? t.tokenAddress.toLowerCase() : null; // may be Move type
    return fa === clean || coin === clean;
  });
  if (!found) {
    // Special-case mapping for APT when key is 0xa
    if (clean === '0xa' || address === '0xa') {
      const apt = tokens.find((t: any) =>
        (t.tokenAddress && t.tokenAddress.toLowerCase() === '0x1::aptos_coin::aptoscoin') ||
        (t.symbol === 'APT')
      );
      if (apt) {
        return {
          symbol: apt.symbol || 'APT',
          decimals: typeof apt.decimals === 'number' ? apt.decimals : 8,
          logoUrl: apt.logoUrl || null,
        };
      }
    }
    return null;
  }
  return {
    symbol: found.symbol || found.panoraSymbol || 'UNKNOWN',
    decimals: typeof found.decimals === 'number' ? found.decimals : 8,
    logoUrl: found.logoUrl || null,
  };
}

async function callView(functionFullname: string, args: any[]): Promise<any> {
  const res = await fetch(FULLNODE_VIEW_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: functionFullname, type_arguments: [], arguments: args })
  });
  if (!res.ok) throw new Error(`View call failed: ${res.status} ${res.statusText}`);
  return res.json();
}

function toHuman(amount: string, decimals: number): number {
  const bn = BigInt(amount || '0');
  const base = 10n ** BigInt(decimals);
  const intPart = Number(bn / base);
  const fracPart = Number(bn % base) / Number(base);
  return intPart + fracPart;
}

function normalizeEntries(raw: any): Array<{ key: string; value: string }> {
  if (!raw) return [];
  // Shape A: { data: [ { key: { inner }, value }, ... ] }
  if (raw && typeof raw === 'object' && Array.isArray((raw as any).data)) {
    return raw.data.map((e: any) => ({ key: e?.key?.inner || e?.key || '', value: String(e?.value ?? '0') }));
  }
  // Shape B: [ { key: { inner }, value }, ... ]
  if (Array.isArray(raw)) {
    return raw.map((e: any) => ({ key: e?.key?.inner || e?.key || '', value: String(e?.value ?? '0') }));
  }
  // Shape C: direct map { [key]: value }
  if (typeof raw === 'object') {
    return Object.entries(raw).map(([k, v]) => ({ key: k, value: String(v) }));
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    if (!address) {
      return NextResponse.json({ success: false, error: 'Address is required' }, { status: 400 });
    }

    // Single view call for pools [0,1,2,3]
    // Pass pools as strings to satisfy u64 vector encoding
    const vectorPools = ["0", "1", "2", "3"];
    const viewResp = await callView(VIEW_FUNCTION, [address, vectorPools]);
    // View may return either [Array<PoolInfo>] or Array<PoolInfo>; handle both
    const rawArray = Array.isArray(viewResp)
      ? (Array.isArray(viewResp[0]) ? (viewResp[0] || []) : viewResp)
      : [];

    const results = (rawArray as any[]).map((item: any, idx: number) => {
      const entries = normalizeEntries(item?.rewards);
      const rewards = entries.map((entry: any) => {
        const key = entry.key || '';
        const meta = findTokenMetaFromList(key) || KNOWN_TOKEN_META[key] || { symbol: 'UNKNOWN', decimals: 8 };
        return {
          tokenKey: key,
          symbol: meta.symbol,
          decimals: meta.decimals,
          amountRaw: String(entry.value),
          amount: toHuman(String(entry.value), meta.decimals),
          logoUrl: meta.logoUrl
        };
      });

      const stakedRaw = String(item?.staked ?? item?.staked_amount ?? '0');
      const walletBalanceRaw = String(item?.wallet_balance ?? item?.wallet_lp_balance ?? '0');
      const unlockTime = Number(item?.unlock_time ?? item?.unlockTimestamp ?? 0);
      const defaultDecimals = 8; // assume 8 for LP until specified

      return {
        pool: idx,
        rewards,
        stakedRaw,
        staked: toHuman(stakedRaw, defaultDecimals),
        walletBalanceRaw,
        walletBalance: toHuman(walletBalanceRaw, defaultDecimals),
        unlockTime,
      };
    });

    return NextResponse.json({ success: true, data: results }, {
      headers: {
        'Cache-Control': 'public, max-age=2, s-maxage=2, stale-while-revalidate=4'
      }
    });
  } catch (error) {
    return NextResponse.json({ success: true, data: [] }, { status: 200 });
  }
}


