'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { normalizeAddress } from '@/lib/utils/addressNormalization';
import { formatNumber } from '@/lib/utils/numberFormat';
import Image from 'next/image';
import { DecibelOpenPositionModal } from '@/components/decibel/decibel-open-position-modal';
import { fetchFundingApr, type FundingAprResult } from '@/lib/protocols/decibel/fundingApr';
import { cn } from '@/lib/utils';

/** Logo URLs for the three fixed perp markets. BTC and ETH from Decibel app; APT from Panora. */
const MARKET_LOGOS: Record<string, string> = {
  'BTC/USD': 'https://app.decibel.trade/images/icons/btc.svg?dpl=dpl_FECfRSDXc1wiUcCXB6MPHgx2CzKp',
  'APT/USD': 'https://assets.panora.exchange/tokens/aptos/apt.svg',
  'ETH/USD': 'https://app.decibel.trade/images/icons/eth.svg?dpl=dpl_FECfRSDXc1wiUcCXB6MPHgx2CzKp',
};

interface DecibelMarket {
  market_addr?: string;
  market_name?: string;
  [key: string]: unknown;
}

interface DecibelPrice {
  market?: string;
  mark_px?: number;
  oracle_px?: number;
  funding_rate_bps?: number;
  is_funding_positive?: boolean;
  open_interest?: number;
}

export function DecibelIdeasBlock() {
  const [markets, setMarkets] = useState<DecibelMarket[]>([]);
  const [pricesByMarket, setPricesByMarket] = useState<Record<string, DecibelPrice>>({});
  const [fundingByKey, setFundingByKey] = useState<Record<string, FundingAprResult | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<{
    marketAddr: string;
    marketName: string;
    marketLogoUrl?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/protocols/decibel/markets').then((r) => r.json()),
      fetch('/api/protocols/decibel/prices').then((r) => r.json()),
    ])
      .then(([marketsRes, pricesRes]) => {
        if (cancelled) return;
        if (!marketsRes?.success || !Array.isArray(marketsRes.data)) {
          setMarkets([]);
          setPricesByMarket({});
          return;
        }
        const list = marketsRes.data as DecibelMarket[];
        setMarkets(list);

        const byMarket: Record<string, DecibelPrice> = {};
        if (pricesRes?.success && Array.isArray(pricesRes.data)) {
          for (const p of pricesRes.data as DecibelPrice[]) {
            const addr = p.market;
            if (addr != null) byMarket[normalizeAddress(String(addr))] = p;
          }
        }
        setPricesByMarket(byMarket);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Pick 3: BTC/USD, APT/USD, ETH/USD (fixed order)
  const normalizedMarkets = markets.map((m) => ({
    ...m,
    key: m.market_addr != null ? normalizeAddress(String(m.market_addr)) : '',
  }));
  const btcMarket = normalizedMarkets.find(
    (m) => (m.market_name || '').toUpperCase().includes('BTC/USD') || (m.market_name || '').toUpperCase() === 'BTC/USD'
  );
  const aptMarket = normalizedMarkets.find(
    (m) => (m.market_name || '').toUpperCase().includes('APT/USD') || (m.market_name || '').toUpperCase() === 'APT/USD'
  );
  const ethMarket = normalizedMarkets.find(
    (m) => (m.market_name || '').toUpperCase().includes('ETH/USD') || (m.market_name || '').toUpperCase() === 'ETH/USD'
  );

  const threeMarkets = [btcMarket, aptMarket, ethMarket].filter(Boolean) as typeof normalizedMarkets;
  const marketKeysStr = threeMarkets.map((m) => m.key).filter(Boolean).join(',');

  // Fetch 24h funding APR per market (cached 10 min)
  useEffect(() => {
    if (!marketKeysStr) return;
    let cancelled = false;
    threeMarkets.forEach((m) => {
      const name = m.market_name;
      if (!name || !m.key) return;
      fetchFundingApr(name).then((data) => {
        if (!cancelled) setFundingByKey((prev) => ({ ...prev, [m.key]: data }));
      });
    });
    return () => { cancelled = true; };
  }, [marketKeysStr]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 w-full flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
                  <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-5 w-14 ml-auto shrink-0 rounded bg-muted animate-pulse" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-24 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-16 bg-muted animate-pulse rounded mb-4" />
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error}
        <button
          type="button"
          className="ml-2 underline"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </p>
    );
  }

  if (threeMarkets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No Decibel perp markets available.</p>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {threeMarkets.map((m) => {
        const priceInfo = pricesByMarket[m.key];
        const markPx = priceInfo?.mark_px;
        const marketName = m.market_name || '—';
        const logoUrl = MARKET_LOGOS[marketName];
        const priceDecimals = marketName.toUpperCase().includes('BTC/USD') ? 0 : marketName.toUpperCase().includes('ETH/USD') ? 1 : 4;
        const funding = fundingByKey[m.key];
        const apr = funding?.avg_yearly_apr_pct;
        const direction = funding?.direction ?? '—';
        const aprColor =
          apr != null && Number.isFinite(apr)
            ? apr > 0
              ? 'text-green-600 dark:text-green-400'
              : apr < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
            : 'text-muted-foreground';

        return (
          <Card key={m.key} className="border-2 min-w-0">
            <CardHeader className="min-w-0 overflow-visible">
              <CardTitle className="flex items-center gap-2 w-full flex-wrap min-w-0">
                {logoUrl ? (
                  <div className="w-6 h-6 relative shrink-0 overflow-visible flex items-center justify-center">
                    <Image src={logoUrl} alt="" width={24} height={24} className="object-contain" unoptimized />
                  </div>
                ) : null}
                <div className="flex items-center min-w-0 flex-1 overflow-hidden">
                  <span className="truncate">{marketName}</span>
                </div>
                <Badge variant="outline" className="shrink-0">Decibel</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {typeof markPx === 'number' && (
                <>
                  <div className="text-lg font-bold">{formatNumber(markPx, priceDecimals)}</div>
                  <p className="text-xs text-muted-foreground">Mark price</p>
                </>
              )}
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <p>
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted underline-offset-1" tabIndex={0}>
                          Funding APR (24h):
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px]">
                        24h funding rate annualized (extrapolated to yearly yield).
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {' '}
                  {apr != null && Number.isFinite(apr) ? (
                    <span className={cn('font-medium', aprColor)}>
                      {apr > 0 ? '+' : ''}{formatNumber(apr, 2)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {direction !== '—' && ` · ${direction}`}
                </p>
              </div>
              <Button
                className="mt-4 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs whitespace-normal min-h-9 py-2 leading-tight"
                onClick={() =>
                  setSelectedMarket({
                    marketAddr: m.key,
                    marketName,
                    marketLogoUrl: logoUrl,
                  })
                }
              >
                Open position
              </Button>
            </CardContent>
          </Card>
        );
      })}
      </div>
      <DecibelOpenPositionModal
        open={!!selectedMarket}
        onOpenChange={(open) => !open && setSelectedMarket(null)}
        market={selectedMarket}
      />
    </>
  );
}
