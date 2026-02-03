import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';
import { PanoraPricesService } from '@/lib/services/panora/prices';

const ECHO_CONTRACT = '0xeab7ea4d635b6b6add79d5045c4a45d8148d88287b1cfa1c3b6a4b56f46839ed';
const FULLNODE_VIEW_URL = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
const APTOS_API_KEY = process.env.APTOS_API_KEY;

type ATokenInfo = { symbol: string; token_address: string };

function normalizeTokenAddress(address: string): string {
  if (!address) return '';
  let clean = address.startsWith('0x') ? address : `0x${address}`;
  clean = '0x' + clean.slice(2).replace(/^0+/, '') || '0x0';
  return clean;
}

async function callView(functionFullname: string, args: string[]): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (APTOS_API_KEY) headers['Authorization'] = `Bearer ${APTOS_API_KEY}`;
  const res = await fetch(FULLNODE_VIEW_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ function: functionFullname, type_arguments: [], arguments: args }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Echo view error: ${res.status} ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function parseATokens(result: unknown): ATokenInfo[] {
  if (!Array.isArray(result)) return [];
  const arr = result.length === 1 && Array.isArray(result[0]) ? result[0] : result;
  return arr.map((item: unknown) => {
    if (Array.isArray(item) && item.length >= 2) {
      return { symbol: String(item[0]), token_address: normalizeTokenAddress(String(item[1])) };
    }
    if (item && typeof item === 'object' && 'symbol' in item && 'token_address' in item) {
      return {
        symbol: String((item as ATokenInfo).symbol),
        token_address: normalizeTokenAddress(String((item as ATokenInfo).token_address)),
      };
    }
    return null;
  }).filter(Boolean) as ATokenInfo[];
}

function parseScaledBalanceAndSupply(result: unknown): [string, string] {
  if (Array.isArray(result) && result.length >= 2) {
    return [String(result[0] ?? '0'), String(result[1] ?? '0')];
  }
  return ['0', '0'];
}

async function getTokenInfo(address: string): Promise<{ symbol: string; name: string; decimals: number; logoUrl: string | null; priceUSD: number | null } | null> {
  const baseUrl = typeof window === 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000') : '';
  try {
    const res = await fetch(`${baseUrl}/api/tokens/info?address=${encodeURIComponent(address)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success || !data?.data) return null;
    const d = data.data;
    return {
      symbol: d.symbol || 'Unknown',
      name: d.name || d.symbol || 'Unknown',
      decimals: Number(d.decimals) || 8,
      logoUrl: d.logoUrl ?? null,
      priceUSD: d.price != null ? Number(d.price) : null,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    if (!address) {
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
    }

    const userAddress = normalizeTokenAddress(address);
    const poolDataProvider = `${ECHO_CONTRACT}::pool_data_provider`;
    const variableTokenFactory = `${ECHO_CONTRACT}::variable_token_factory`;

    const aTokensResult = await callView(`${poolDataProvider}::get_all_a_tokens`, []);
    const aTokens = parseATokens(aTokensResult);
    if (aTokens.length === 0) {
      return NextResponse.json(
        { success: true, data: [] },
        { headers: { 'Cache-Control': 'public, max-age=3, s-maxage=3, stale-while-revalidate=6' } }
      );
    }

    type RawPosition = { aToken: ATokenInfo; aTokenAddr: string; scaledBalanceStr: string; underlyingNorm: string };
    const rawPositions: RawPosition[] = [];

    for (const aToken of aTokens) {
      const aTokenAddr = aToken.token_address.startsWith('0x') ? aToken.token_address : `0x${aToken.token_address}`;
      const [scaledBalanceStr] = parseScaledBalanceAndSupply(
        await callView(`${variableTokenFactory}::get_scaled_user_balance_and_supply`, [userAddress, aTokenAddr])
      );
      const scaledBalance = BigInt(scaledBalanceStr || '0');
      if (scaledBalance === BigInt(0)) continue;

      let underlyingAddr: string;
      try {
        const raw = await callView(`${variableTokenFactory}::get_underlying_asset_address`, [aTokenAddr]);
        underlyingAddr = Array.isArray(raw) && raw[0] != null
          ? normalizeTokenAddress(String(raw[0]))
          : (raw && typeof raw === 'object' && 'inner' in (raw as { inner?: string }) ? normalizeTokenAddress(String((raw as { inner: string }).inner)) : '');
      } catch {
        continue;
      }
      if (!underlyingAddr) continue;
      const underlyingNorm = underlyingAddr.startsWith('0x') ? underlyingAddr : `0x${underlyingAddr}`;
      rawPositions.push({ aToken, aTokenAddr, scaledBalanceStr, underlyingNorm });
    }

    const underlyingAddresses = [...new Set(rawPositions.map((r) => r.underlyingNorm))];
    const priceMap: Record<string, number> = {};
    if (underlyingAddresses.length > 0) {
      try {
        const pricesService = PanoraPricesService.getInstance();
        const pricesResponse = await pricesService.getPrices(1, underlyingAddresses);
        const pricesData = (pricesResponse as { data?: Array<{ tokenAddress?: string; faAddress?: string; usdPrice?: string }> }).data ?? (Array.isArray(pricesResponse) ? pricesResponse : []);
        for (const p of pricesData) {
          const addr = p.tokenAddress || p.faAddress;
          const price = p.usdPrice != null ? parseFloat(String(p.usdPrice)) : 0;
          if (addr) {
            priceMap[addr] = price;
            priceMap[normalizeAddress(addr)] = price;
          }
        }
      } catch (e) {
        console.warn('[Echo] Price fetch error:', e);
      }
    }

    const positions = await Promise.all(
      rawPositions.map(async ({ aToken, aTokenAddr, scaledBalanceStr, underlyingNorm }) => {
        const tokenInfo = await getTokenInfo(underlyingNorm);
        const decimals = tokenInfo?.decimals ?? 8;
        const amount = Number(scaledBalanceStr) / Math.pow(10, decimals);
        const priceUSD = priceMap[underlyingNorm] ?? priceMap[normalizeAddress(underlyingNorm)] ?? tokenInfo?.priceUSD ?? 0;
        const valueUSD = amount * priceUSD;
        return {
          positionId: aTokenAddr,
          aTokenAddress: aTokenAddr,
          aTokenSymbol: aToken.symbol,
          underlyingAddress: underlyingNorm,
          symbol: tokenInfo?.symbol ?? aToken.symbol.replace(/^A/, ''),
          name: tokenInfo?.name ?? tokenInfo?.symbol ?? aToken.symbol,
          decimals,
          logoUrl: tokenInfo?.logoUrl ?? null,
          amountRaw: scaledBalanceStr,
          amount,
          priceUSD,
          valueUSD,
        };
      })
    );

    return NextResponse.json(
      { success: true, data: positions },
      { headers: { 'Cache-Control': 'public, max-age=3, s-maxage=3, stale-while-revalidate=6' } }
    );
  } catch (error) {
    console.error('[Echo] userPositions error:', error);
    return NextResponse.json({ success: true, data: [] }, { status: 200 });
  }
}
