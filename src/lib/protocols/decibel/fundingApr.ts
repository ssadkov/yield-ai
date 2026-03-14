/**
 * Fetches Decibel funding APR (24h weighted average) from external API.
 * In-memory cache per market_name, TTL 10 minutes, to avoid repeated requests.
 */

/** Use our API route to avoid CORS when fetching from the client */
const FUNDING_API_BASE = '/api/protocols/decibel/funding';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface FundingAprResult {
  avg_yearly_apr_pct: number;
  direction: string;
}

interface CacheEntry {
  data: FundingAprResult;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Normalize Decibel market name to API format (e.g. "BTC-USDC" -> "BTC/USD").
 */
export function marketNameForFundingApi(displayName: string): string {
  if (!displayName || typeof displayName !== 'string') return displayName;
  const s = displayName.trim().replace(/-/g, '/');
  if (s.toUpperCase().includes('USDC')) return s.replace(/USDC/gi, 'USD');
  return s;
}

/**
 * Fetch weighted average funding APR for a market. Cached per market_name.
 * @param marketName - e.g. "BTC/USD", "APT/USD", "ETH/USD" (or "BTC-USDC" normalized internally)
 * @returns APR % and direction, or null on error / missing data
 */
export async function fetchFundingApr(marketName: string): Promise<FundingAprResult | null> {
  const key = marketNameForFundingApi(marketName);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  try {
    const url = `${FUNDING_API_BASE}?market_name=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || !json?.success || !json?.weighted_average?.success) return null;
    const wa = json.weighted_average;
    const avg = wa.avg_yearly_apr_pct;
    const direction = typeof wa.direction === 'string' ? wa.direction : '—';
    if (typeof avg !== 'number' || !Number.isFinite(avg)) return null;
    const data: FundingAprResult = { avg_yearly_apr_pct: avg, direction };
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch {
    return null;
  }
}
