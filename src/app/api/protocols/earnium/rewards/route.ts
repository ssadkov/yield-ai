import { NextRequest, NextResponse } from 'next/server';
import tokenList from '@/lib/data/tokenList.json';

const FULLNODE_VIEW_URL = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
const INDEXER_GRAPHQL_URL = 'https://indexer.mainnet.aptoslabs.com/v1/graphql';
const EARNIUM_PACKAGE = '0x7c92a9636a412407aaede35eb2654d176477c00a47bc11ea3338d1f571ec95bc';
// New single-call view: returns an array of per-pool objects { rewards: { data: [...] }, staked, unlock_time, wallet_balance }
const VIEW_FUNCTION = `${EARNIUM_PACKAGE}::premium_staked_pool::user_info`;
const VIEW_POOL_ADDRESS = `${EARNIUM_PACKAGE}::premium_staked_pool::user_balances_pool`;
const VIEW_STAKE_TOKEN = `${EARNIUM_PACKAGE}::user_balance::stake_token`;
const VIEW_FA_TOTAL_SUPPLY = `0x1::fungible_asset::total_supply`;
const VIEW_FA_SUPPLY_OF = `0x1::fungible_asset::supply_of`;
const FA_METADATA_RESOURCE = `0x1::fungible_asset::Metadata`;

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

function unwrapInner(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return unwrapInner(value[0]);
  if (typeof value === 'object' && typeof value.inner === 'string') return value.inner;
  return null;
}

async function callView(functionFullname: string, args: any[]): Promise<any> {
  const res = await fetch(FULLNODE_VIEW_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: functionFullname, type_arguments: [], arguments: args })
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('[Earnium][VIEW ERROR]', functionFullname, 'args:', JSON.stringify(args), '->', res.status, res.statusText, text);
    throw new Error(`VIEW ERROR ${res.status} ${res.statusText}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function fetchFaMetaFromIndexer(assetType: string): Promise<{ symbol: string | null; decimals: number | null; supplyRaw: string | null }> {
  try {
    const query = `query GetFATokenSupply($assetType: String!) { fungible_asset_metadata(where: {asset_type: {_eq: $assetType}}) { symbol decimals supply_v2 } }`;
    const res = await fetch(INDEXER_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { assetType } })
    });
    const json = await res.json();
    const meta = json?.data?.fungible_asset_metadata?.[0];
    if (!meta) return { symbol: null, decimals: null, supplyRaw: null };
    return {
      symbol: meta.symbol ?? null,
      decimals: typeof meta.decimals === 'number' ? meta.decimals : Number(meta.decimals ?? 8),
      supplyRaw: meta.supply_v2 ? String(meta.supply_v2) : null,
    };
  } catch (e) {
    console.warn('[Earnium][INDEXER] fetch meta failed for', assetType, e);
    return { symbol: null, decimals: null, supplyRaw: null };
  }
}

function toHuman(amount: string, decimals: number): number {
  try {
    const bn = BigInt(amount || '0');
    const base = (BigInt(10) ** BigInt(decimals));
    const intPart = Number(bn / base);
    const fracPart = Number(bn % base) / Number(base);
    return intPart + fracPart;
  } catch {
    const num = Number(amount || '0');
    return num / Math.pow(10, decimals);
  }
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

    const results = await Promise.all((rawArray as any[]).map(async (item: any, idx: number) => {
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
      let poolAddress: string | null = null;
      let lpInfo: any = null;
      if (BigInt(stakedRaw || '0') > BigInt(0)) {
        console.log('[Earnium][LP] pool', idx, 'stakedRaw', stakedRaw, 'walletBalanceRaw', walletBalanceRaw);
        try {
          const addrResp = await callView(VIEW_POOL_ADDRESS, [String(idx)]);
          console.log('[Earnium][LP] addrResp', JSON.stringify(addrResp));
          poolAddress = unwrapInner(addrResp);
          console.log('[Earnium][LP] poolAddress', poolAddress);
          if (poolAddress) {
            // 1) get LP metadata object id via stake_token(UBP)
            const stakeTokResp = await callView(VIEW_STAKE_TOKEN, [poolAddress]);
            console.log('[Earnium][LP] stakeTokResp', JSON.stringify(stakeTokResp));
            const lpMetadataId = unwrapInner(stakeTokResp);
            console.log('[Earnium][LP] lpMetadataId', lpMetadataId);
            // 2) Get supply strictly from Indexer (on-chain indexed)
            let decimals = defaultDecimals;
            let symbol: string | null = null;
            let totalSupplyRaw = '0';
            if (lpMetadataId) {
              const idx = await fetchFaMetaFromIndexer(lpMetadataId);
              if (idx.supplyRaw) totalSupplyRaw = idx.supplyRaw;
              if (idx.decimals != null) decimals = idx.decimals;
              if (idx.symbol != null) symbol = idx.symbol;
              console.log('[Earnium][INDEXER] meta', { decimals, symbol, totalSupplyRaw });
            }
            const totalSupply = toHuman(totalSupplyRaw, decimals);
            // 4) user share in % (use integers to keep precision)
            let sharePercent = 0;
            try {
              const denom = BigInt(totalSupplyRaw || '0');
              if (denom > BigInt(0)) {
                const numer = (BigInt(stakedRaw || '0') * BigInt(10000)); // two decimals
                sharePercent = Number(numer / denom) / 100; // xx.xx%
              }
            } catch {}
            lpInfo = {
              ubpId: poolAddress,
              metadataId: lpMetadataId,
              symbol,
              decimals,
              totalSupplyRaw,
              totalSupply,
              sharePercent,
            };
            console.log('[Earnium][LP] summary', { pool: idx, ubpId: poolAddress, metadataId: lpMetadataId, decimals, totalSupplyRaw, sharePercent });
          }
        } catch {}
      }

      return {
        pool: idx,
        rewards,
        stakedRaw,
        staked: toHuman(stakedRaw, defaultDecimals),
        walletBalanceRaw,
        walletBalance: toHuman(walletBalanceRaw, defaultDecimals),
        unlockTime,
        poolAddress,
        lp: lpInfo,
      };
    }));

    return NextResponse.json({ success: true, data: results }, {
      headers: {
        'Cache-Control': 'public, max-age=2, s-maxage=2, stale-while-revalidate=4'
      }
    });
  } catch (error) {
    return NextResponse.json({ success: true, data: [] }, { status: 200 });
  }
}


