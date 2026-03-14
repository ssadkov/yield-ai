'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { WalletSelector } from '@/components/WalletSelector';
import { DecibelCTABlock } from '@/components/ui/decibel-cta-block';
import { DecibelFundingChart, type RawFundingRecord } from '@/components/decibel/decibel-funding-chart';
import { DecibelOpenPositionModal, type DecibelOpenPositionMarket } from '@/components/decibel/decibel-open-position-modal';
import { fetchFundingApr, marketNameForFundingApi } from '@/lib/protocols/decibel/fundingApr';
import { formatNumber } from '@/lib/utils/numberFormat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const MARKET_LOGOS: Record<string, string> = {
  'BTC/USD': 'https://app.decibel.trade/images/icons/btc.svg?dpl=dpl_FECfRSDXc1wiUcCXB6MPHgx2CzKp',
  'APT/USD': 'https://assets.panora.exchange/tokens/aptos/apt.svg',
  'ETH/USD': 'https://app.decibel.trade/images/icons/eth.svg?dpl=dpl_FECfRSDXc1wiUcCXB6MPHgx2CzKp',
  'SOL/USD': 'https://app.decibel.trade/images/icons/sol.svg?dpl=dpl_FECfRSDXc1wiUcCXB6MPHgx2CzKp',
  'DOGE/USD': 'https://app.decibel.trade/images/icons/doge.svg?dpl=dpl_FECfRSDXc1wiUcCXB6MPHgx2CzKp',
  'XRP/USD': 'https://app.decibel.trade/images/icons/xrp.svg?dpl=dpl_FECfRSDXc1wiUcCXB6MPHgx2CzKp',
  'BNB/USD': 'https://app.decibel.trade/images/icons/bnb.svg?dpl=dpl_FECfRSDXc1wiUcCXB6MPHgx2CzKp',
  'SUI/USD': 'https://assets.panora.exchange/tokens/aptos/sui.svg',
  'HYPE/USD': 'https://app.decibel.trade/images/icons/hype.svg?dpl=dpl_FECfRSDXc1wiUcCXB6MPHgx2CzKp',
  'ZEC/USD': 'https://app.decibel.trade/images/icons/zec.svg?dpl=dpl_FECfRSDXc1wiUcCXB6MPHgx2CzKp',
};

interface DecibelMarketRow {
  market_addr: string;
  market_name?: string;
}

function getLogoUrl(marketName: string): string | undefined {
  const key = marketNameForFundingApi(marketName);
  return MARKET_LOGOS[key];
}

/** Latest open interest per market (normalized name e.g. BTC/USD) from raw funding data */
function latestOIPerMarket(data: RawFundingRecord[]): Record<string, number> {
  const byMarket: Record<string, { ts: number; oi: number }> = {};
  for (const row of data) {
    const name = row.market_name;
    if (!name || typeof name !== 'string') continue;
    const ts = typeof row.transaction_unix_ms === 'number' ? row.transaction_unix_ms : 0;
    const oi = typeof row.open_interest === 'number' ? row.open_interest : 0;
    const prev = byMarket[name];
    if (!prev || ts > prev.ts) byMarket[name] = { ts, oi };
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(byMarket)) out[k] = v.oi;
  return out;
}

export default function DecibelFundingPage() {
  const [rawFunding, setRawFunding] = useState<RawFundingRecord[] | null>(null);
  const [markets, setMarkets] = useState<DecibelMarketRow[]>([]);
  const [fundingAprByMarket, setFundingAprByMarket] = useState<Record<string, { avg_yearly_apr_pct: number; direction: string } | null>>({});
  const [selectedMarket, setSelectedMarket] = useState<DecibelOpenPositionMarket | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/protocols/decibel/funding')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && Array.isArray(json.data)) {
          setRawFunding(json.data as RawFundingRecord[]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/protocols/decibel/markets')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && Array.isArray(json.data)) {
          const list = (json.data as DecibelMarketRow[]).filter(
            (m) => m.market_addr && (m.market_name || '').toUpperCase().includes('USD')
          );
          setMarkets(list);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (markets.length === 0) return;
    let cancelled = false;
    const keys = markets.map((m) => marketNameForFundingApi(m.market_name || ''));
    Promise.all(keys.map((k) => fetchFundingApr(k)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, { avg_yearly_apr_pct: number; direction: string } | null> = {};
        markets.forEach((m, i) => {
          const key = marketNameForFundingApi(m.market_name || '');
          map[key] = results[i];
        });
        setFundingAprByMarket(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [markets]);

  const oiByMarket = useMemo(() => (rawFunding ? latestOIPerMarket(rawFunding) : {}), [rawFunding]);

  /** Markets sorted by Open Interest descending (largest first) */
  const marketsSortedByOI = useMemo(() => {
    return [...markets].sort((a, b) => {
      const keyA = marketNameForFundingApi(a.market_name || '');
      const keyB = marketNameForFundingApi(b.market_name || '');
      const oiA = oiByMarket[keyA] ?? -Infinity;
      const oiB = oiByMarket[keyB] ?? -Infinity;
      return oiB - oiA;
    });
  }, [markets, oiByMarket]);

  return (
    <div className="h-screen flex flex-col md:flex-row bg-background overflow-hidden">
      {/* Left: Logo, Wallet, Decibel CTA, then explanation */}
      <aside className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-border p-4 flex flex-col gap-4 overflow-y-auto">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Logo size="sm" className="shrink-0" />
          <span className="font-semibold text-sm">Yield AI</span>
        </Link>
        <div className="shrink-0">
          <WalletSelector />
        </div>
        <div className="shrink-0">
          <DecibelCTABlock />
        </div>
        <div className="mt-2 pt-3 border-t border-border text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">About the chart</p>
          <p>
            The chart shows the funding rate in basis points (bps) over time for each market. Positive values mean longs pay shorts; negative means shorts pay longs. Rates are smoothed (rolling average) from raw snapshots.
          </p>
          <p className="font-medium text-foreground mt-2">Open Interest</p>
          <p>
            Open Interest (OI) is the total notional value of open positions in a market. Higher OI usually means more liquidity and more stable funding.
          </p>
        </div>
      </aside>

      {/* Center: Chart — fits remaining height */}
      <main className="flex-1 min-w-0 min-h-0 p-4 flex flex-col overflow-hidden">
        <h1 className="text-xl font-bold mb-1 shrink-0">Decibel funding</h1>
        <p className="text-sm text-muted-foreground mb-2 shrink-0">
          Funding rate (bps) over time by market. Positive = longs pay shorts.
        </p>
        <div className="flex-1 min-h-0 flex flex-col">
          <DecibelFundingChart rawData={rawFunding} className="w-full flex-1 min-h-0" />
        </div>
      </main>

      {/* Right: Markets list (sorted by Open Interest desc) */}
      <aside className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-border p-4 overflow-y-auto">
        <h2 className="text-sm font-semibold mb-3">Markets</h2>
        <ul className="space-y-2">
          {marketsSortedByOI.map((m) => {
            const name = m.market_name || '';
            const key = marketNameForFundingApi(name);
            const apr = fundingAprByMarket[key];
            const oi = oiByMarket[key];
            const logoUrl = getLogoUrl(name);
            return (
              <li
                key={m.market_addr}
                className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-card hover:bg-muted/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {logoUrl && (
                    <Image
                      src={logoUrl}
                      alt=""
                      width={20}
                      height={20}
                      className="shrink-0 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium truncate">{name || m.market_addr.slice(0, 8)}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    APR 24h:{' '}
                    {apr != null && Number.isFinite(apr.avg_yearly_apr_pct) ? (
                      <span
                        className={cn(
                          'font-medium',
                          apr.avg_yearly_apr_pct > 0 ? 'text-green-600 dark:text-green-400' : apr.avg_yearly_apr_pct < 0 ? 'text-red-600 dark:text-red-400' : ''
                        )}
                      >
                        {apr.avg_yearly_apr_pct > 0 ? '+' : ''}
                        {formatNumber(apr.avg_yearly_apr_pct, 2)}%
                      </span>
                    ) : (
                      '—'
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Open Interest: {typeof oi === 'number' && Number.isFinite(oi) ? formatNumber(oi, 0) : '—'}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 h-7 text-xs"
                    onClick={() =>
                      setSelectedMarket({
                        marketAddr: m.market_addr,
                        marketName: name,
                        marketLogoUrl: logoUrl,
                      })
                    }
                  >
                    Open position
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        {marketsSortedByOI.length === 0 && (
          <p className="text-sm text-muted-foreground">Loading markets…</p>
        )}
      </aside>

      <DecibelOpenPositionModal
        open={!!selectedMarket}
        onOpenChange={(open) => !open && setSelectedMarket(null)}
        market={selectedMarket}
      />
    </div>
  );
}
