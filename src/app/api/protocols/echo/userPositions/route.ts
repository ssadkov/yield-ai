import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';
import { PanoraPricesService } from '@/lib/services/panora/prices';
import tokenList from '@/lib/data/tokenList.json';
import { getReserveApyMetrics, EchoReserveData } from '@/lib/utils/apy';

const ECHO_CONTRACT = '0xeab7ea4d635b6b6add79d5045c4a45d8148d88287b1cfa1c3b6a4b56f46839ed';
// Canonical USDC FA address (used for USDCn pricing/decimals normalization)
const CANONICAL_USDC_FA_ADDRESS = '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b';
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

/** Parses scaled balance from pool::scale_a_token_balance_of (returns single u256). */
function parseScaledBalance(result: unknown): string {
  if (result == null) return '0';
  if (Array.isArray(result) && result.length >= 1 && result[0] != null) return String(result[0]);
  if (typeof result === 'number' && Number.isFinite(result)) return String(Math.floor(result));
  if (typeof result === 'string') return result;
  return '0';
}

function canonicalizeEchoSymbol(symbolGuess: string): { symbol: string; pricingAddressOverride?: string; decimalsOverride?: number } {
  // Echo can return underlying symbols like "USDCn". We normalize to canonical assets for pricing/decimals.
  if (symbolGuess === 'USDCn') {
    return { symbol: 'USDC', pricingAddressOverride: CANONICAL_USDC_FA_ADDRESS, decimalsOverride: 6 };
  }
  return { symbol: symbolGuess };
}

function parseReserveData(result: unknown): EchoReserveData {
  if (!result) return {};
  if (Array.isArray(result)) {
    if (result.length === 0) return {};
    const first = result.length === 1 ? result[0] : result[0];
    if (first && typeof first === 'object') {
      return first as EchoReserveData;
    }
    return {};
  }
  if (typeof result === 'object') {
    return result as EchoReserveData;
  }
  return {};
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

/** Find token in tokenList by symbol; return faAddress or tokenAddress for Panora lookup. */
function getTokenAddressFromTokenListBySymbol(symbol: string): string | null {
  const tokens = (tokenList as { data: { data: Array<{ symbol?: string; faAddress?: string; tokenAddress?: string }> } }).data.data;
  const t = tokens.find((x) => x.symbol?.toLowerCase() === symbol?.toLowerCase());
  if (!t) return null;
  const addr = t.faAddress ?? t.tokenAddress ?? null;
  return addr ? normalizeTokenAddress(addr) : null;
}

/** Fallback: get price from tokenList by symbol when Panora returns 0. */
function getPriceFromTokenListBySymbol(symbol: string): number | null {
  const tokens = (tokenList as { data: { data: Array<{ symbol?: string; usdPrice?: string }> } }).data.data;
  const t = tokens.find((x) => x.symbol?.toLowerCase() === symbol?.toLowerCase());
  if (!t?.usdPrice) return null;
  const p = parseFloat(t.usdPrice);
  return Number.isFinite(p) ? p : null;
}

/** Parses underlying_token_factory::get_coin_asset_pairs() → [types[], addresses[]]. Returns map: coin type → FA address. */
function parseCoinAssetPairs(result: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(result) || result.length < 2) return map;
  const typesArr = Array.isArray(result[0]) ? result[0] : (typeof result[0] === 'object' && result[0] != null ? [] : [result[0]]);
  const addrsArr = Array.isArray(result[1]) ? result[1] : (typeof result[1] === 'object' && result[1] != null ? [] : [result[1]]);
  const len = Math.min(typesArr.length, addrsArr.length);
  for (let i = 0; i < len; i++) {
    const t = String(typesArr[i] ?? '');
    const a = String(addrsArr[i] ?? '').trim();
    if (t && a) {
      const fa = normalizeTokenAddress(a);
      map.set(t, fa);
      map.set(fa, fa); // address → FA (so we resolve by address too)
    }
  }
  return map;
}

/** Resolve underlying (type string or address) to FA address for pricing using get_coin_asset_pairs map. */
function resolveUnderlyingToFa(underlying: string, coinAssetPairs: Map<string, string>): string {
  if (!underlying) return '';
  const norm = underlying.includes('::') ? underlying.trim() : normalizeTokenAddress(underlying);
  return coinAssetPairs.get(norm) ?? coinAssetPairs.get(underlying) ?? norm;
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
    const underlyingTokenFactory = `${ECHO_CONTRACT}::underlying_token_factory`;
    const poolView = `${ECHO_CONTRACT}::pool::scale_a_token_balance_of`;
    const scaleVariableTokenBalanceView = `${ECHO_CONTRACT}::pool::scale_variable_token_balance_of`;

    const [aTokensResult, varTokensResult, coinPairsResult] = await Promise.all([
      callView(`${poolDataProvider}::get_all_a_tokens`, []),
      callView(`${poolDataProvider}::get_all_var_tokens`, []),
      callView(`${underlyingTokenFactory}::get_coin_asset_pairs`, []),
    ]);
    const coinAssetPairs = parseCoinAssetPairs(coinPairsResult);
    const aTokens = parseATokens(aTokensResult);
    const varTokens = parseATokens(varTokensResult);

    type RawPosition = { aToken: ATokenInfo; aTokenAddr: string; scaledBalanceStr: string; underlyingNorm: string };
    const rawPositions: RawPosition[] = [];

    for (const aToken of aTokens) {
      const aTokenAddr = aToken.token_address.startsWith('0x') ? aToken.token_address : `0x${aToken.token_address}`;
      const scaledBalanceStr = parseScaledBalance(
        await callView(poolView, [userAddress, aTokenAddr])
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

    type RawBorrowPosition = { varToken: ATokenInfo; varTokenAddr: string; scaledBalanceStr: string; underlyingNorm: string };
    const rawBorrowPositions: RawBorrowPosition[] = [];
    for (const varToken of varTokens) {
      const varTokenAddr = varToken.token_address.startsWith('0x') ? varToken.token_address : `0x${varToken.token_address}`;
      const scaledBalanceStr = parseScaledBalance(
        await callView(scaleVariableTokenBalanceView, [userAddress, varTokenAddr])
      );
      if (BigInt(scaledBalanceStr || '0') === BigInt(0)) continue;
      let underlyingAddr: string;
      try {
        const raw = await callView(`${variableTokenFactory}::get_underlying_asset_address`, [varTokenAddr]);
        underlyingAddr = Array.isArray(raw) && raw[0] != null
          ? normalizeTokenAddress(String(raw[0]))
          : (raw && typeof raw === 'object' && 'inner' in (raw as { inner?: string }) ? normalizeTokenAddress(String((raw as { inner: string }).inner)) : '');
      } catch {
        continue;
      }
      if (!underlyingAddr) continue;
      const underlyingNorm = underlyingAddr.startsWith('0x') ? underlyingAddr : `0x${underlyingAddr}`;
      rawBorrowPositions.push({ varToken, varTokenAddr, scaledBalanceStr, underlyingNorm });
    }

    const pricingAddresses = [
      ...new Set([
        ...rawPositions.map((r) => {
          const symbolGuess = r.aToken.symbol.replace(/^A/, '');
          const canonical = canonicalizeEchoSymbol(symbolGuess);
          const addrFromTokenList = getTokenAddressFromTokenListBySymbol(canonical.symbol);
          return addrFromTokenList ?? canonical.pricingAddressOverride ?? (resolveUnderlyingToFa(r.underlyingNorm, coinAssetPairs) || r.underlyingNorm);
        }),
        ...rawBorrowPositions.map((r) => {
          const symbolGuess = r.varToken.symbol.replace(/^V/, '');
          const canonical = canonicalizeEchoSymbol(symbolGuess);
          const addrFromTokenList = getTokenAddressFromTokenListBySymbol(canonical.symbol);
          return addrFromTokenList ?? canonical.pricingAddressOverride ?? (resolveUnderlyingToFa(r.underlyingNorm, coinAssetPairs) || r.underlyingNorm);
        }),
      ]),
    ];
    const priceMap: Record<string, number> = {};
    if (pricingAddresses.length > 0) {
      try {
        const pricesService = PanoraPricesService.getInstance();
        const pricesResponse = await pricesService.getPrices(1, pricingAddresses);
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

    const reserveAddresses = [
      ...new Set([
        ...rawPositions.map((r) => r.underlyingNorm),
        ...rawBorrowPositions.map((r) => r.underlyingNorm),
      ]),
    ];
    const reserveMetrics: Record<string, ReturnType<typeof getReserveApyMetrics>> = {};
    await Promise.all(
      reserveAddresses.map(async (addr) => {
        try {
          const reserveRaw = await callView(`${ECHO_CONTRACT}::pool::get_reserve_data`, [addr]);
          const reserveData = parseReserveData(reserveRaw);
          reserveMetrics[addr] = getReserveApyMetrics(reserveData);
        } catch (e) {
          console.warn('[Echo] reserve data fetch error:', addr, e);
        }
      }),
    );

    const supplyPositions = await Promise.all(
      rawPositions.map(async ({ aToken, aTokenAddr, scaledBalanceStr, underlyingNorm }) => {
        const symbolGuess = aToken.symbol.replace(/^A/, '');
        const canonical = canonicalizeEchoSymbol(symbolGuess);
        const pricingAddress = getTokenAddressFromTokenListBySymbol(canonical.symbol) ?? canonical.pricingAddressOverride ?? (resolveUnderlyingToFa(underlyingNorm, coinAssetPairs) || underlyingNorm);

        const tokenInfo = await getTokenInfo(pricingAddress);
        const symbol = canonical.symbol;
        const decimals = canonical.decimalsOverride ?? tokenInfo?.decimals ?? 8;
        const amount = Number(scaledBalanceStr) / Math.pow(10, decimals);
        let priceUSD = priceMap[pricingAddress] ?? priceMap[normalizeAddress(pricingAddress)] ?? (tokenInfo?.priceUSD ?? 0);
        if (priceUSD === 0) {
          const fallbackPrice = getPriceFromTokenListBySymbol(symbol);
          if (fallbackPrice != null) priceUSD = fallbackPrice;
        }
        const valueUSD = amount * priceUSD;
        const metrics = reserveMetrics[underlyingNorm];
        return {
          positionId: aTokenAddr,
          aTokenAddress: aTokenAddr,
          aTokenSymbol: aToken.symbol,
          underlyingAddress: underlyingNorm,
          symbol,
          name: tokenInfo?.name ?? tokenInfo?.symbol ?? symbol,
          decimals,
          logoUrl: tokenInfo?.logoUrl ?? null,
          amountRaw: scaledBalanceStr,
          amount,
          priceUSD,
          valueUSD,
          apy: metrics?.supplyApy ?? 0,
          apyFormatted: metrics?.supplyApyFormatted ?? '0.00%',
          type: 'supply' as const,
        };
      })
    );

    const borrowPositions = await Promise.all(
      rawBorrowPositions.map(async ({ varToken, varTokenAddr, scaledBalanceStr, underlyingNorm }) => {
        const symbolGuess = varToken.symbol.replace(/^V/, '');
        const canonical = canonicalizeEchoSymbol(symbolGuess);
        const pricingAddress = getTokenAddressFromTokenListBySymbol(canonical.symbol) ?? canonical.pricingAddressOverride ?? (resolveUnderlyingToFa(underlyingNorm, coinAssetPairs) || underlyingNorm);

        const tokenInfo = await getTokenInfo(pricingAddress);
        const symbol = canonical.symbol;
        const decimals = canonical.decimalsOverride ?? tokenInfo?.decimals ?? 8;
        const amount = Number(scaledBalanceStr) / Math.pow(10, decimals);
        let priceUSD = priceMap[pricingAddress] ?? priceMap[normalizeAddress(pricingAddress)] ?? (tokenInfo?.priceUSD ?? 0);
        if (priceUSD === 0) {
          const fallbackPrice = getPriceFromTokenListBySymbol(symbol);
          if (fallbackPrice != null) priceUSD = fallbackPrice;
        }
        const valueUSD = amount * priceUSD;
        const metrics = reserveMetrics[underlyingNorm];
        return {
          positionId: varTokenAddr,
          aTokenAddress: varTokenAddr,
          aTokenSymbol: varToken.symbol,
          underlyingAddress: underlyingNorm,
          symbol,
          name: tokenInfo?.name ?? tokenInfo?.symbol ?? symbol,
          decimals,
          logoUrl: tokenInfo?.logoUrl ?? null,
          amountRaw: scaledBalanceStr,
          amount,
          priceUSD,
          valueUSD,
          apy: metrics?.borrowApy ?? 0,
          apyFormatted: metrics?.borrowApyFormatted ?? '0.00%',
          type: 'borrow' as const,
        };
      })
    );

    const positions = [...supplyPositions, ...borrowPositions];

    return NextResponse.json(
      { success: true, data: positions },
      { headers: { 'Cache-Control': 'public, max-age=3, s-maxage=3, stale-while-revalidate=6' } }
    );
  } catch (error) {
    console.error('[Echo] userPositions error:', error);
    return NextResponse.json({ success: true, data: [] }, { status: 200 });
  }
}
