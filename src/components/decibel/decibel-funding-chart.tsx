'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  LineSeries,
  ColorType,
  LineType,
  LineStyle,
  type UTCTimestamp,
} from 'lightweight-charts';

/** Raw funding record from external API (no market_name param). */
export interface RawFundingRecord {
  market_name?: string;
  funding_rate_bps?: number;
  is_funding_positive?: number | boolean;
  transaction_unix_ms?: number;
  open_interest?: number;
  [key: string]: unknown;
}

const BUCKET_MS = 60 * 60 * 1000; // 1 hour - dedupe points per market per hour
const CHART_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
  '#a855f7',
];

/** Normalize market name so "SUI/USDC" and "SOL-USDC" match cards (e.g. "SUI/USD"). */
function normalizeMarketKey(name: string): string {
  const s = name.trim().replace(/-/g, '/');
  if (s.toUpperCase().includes('USDC')) return s.replace(/USDC/gi, 'USD');
  return s;
}

function groupByMarket(
  data: RawFundingRecord[]
): Record<string, { time: UTCTimestamp; value: number }[]> {
  const byMarket: Record<string, { time: number; value: number }[]> = {};
  for (const row of data) {
    const name = row.market_name;
    if (!name || typeof name !== 'string') continue;
    const key = normalizeMarketKey(name);
    const bps = typeof row.funding_rate_bps === 'number' ? row.funding_rate_bps : 0;
    const positive = row.is_funding_positive === true || row.is_funding_positive === 1;
    const value = positive ? bps : -bps;
    const ts = typeof row.transaction_unix_ms === 'number' ? row.transaction_unix_ms : 0;
    const bucket = Math.floor(ts / BUCKET_MS) * BUCKET_MS;
    if (!byMarket[key]) byMarket[key] = [];
    const arr = byMarket[key];
    const last = arr[arr.length - 1];
    if (last && last.time === bucket) {
      last.value = value;
    } else {
      arr.push({ time: bucket, value });
    }
  }
  for (const key of Object.keys(byMarket)) {
    byMarket[key].sort((a, b) => a.time - b.time);
    // Merge duplicate buckets (same key from e.g. SUI/USDC and SUI/USD): keep last value per bucket
    const arr = byMarket[key];
    const merged: { time: number; value: number }[] = [];
    for (const p of arr) {
      const last = merged[merged.length - 1];
      if (last && last.time === p.time) last.value = p.value;
      else merged.push({ ...p });
    }
    byMarket[key] = merged;
  }
  return byMarket as Record<string, { time: UTCTimestamp; value: number }[]>;
}

/** Returns market names in chart order (top N by data point count). Use for hover/visibility sync with cards. */
export function getChartMarketOrder(data: RawFundingRecord[] | null, maxSeries = 8): string[] {
  if (!data || data.length === 0) return [];
  const byMarket = groupByMarket(data);
  return Object.entries(byMarket)
    .filter(([, points]) => points.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxSeries)
    .map(([name]) => name);
}

/** Simple moving average to smooth spikes (window size 5). */
function smoothSeries(
  points: { time: number; value: number }[],
  window = 5
): { time: number; value: number }[] {
  if (points.length === 0) return [];
  if (points.length <= window) return points;
  const half = Math.floor(window / 2);
  return points.map((p, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(points.length, i + half + 1);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += points[j].value;
      count++;
    }
    return { time: p.time, value: count ? sum / count : p.value };
  });
}

export interface DecibelFundingChartProps {
  /** If provided, use this data instead of fetching (e.g. from page for single fetch). */
  rawData?: RawFundingRecord[] | null;
  className?: string;
  /** Max number of series to show (by most data points or first N markets). Default 8. */
  maxSeries?: number;
  /** Market name to highlight on the chart (e.g. from card hover). */
  hoveredMarket?: string | null;
  /** Set of market names that should be visible; others are hidden. Undefined = all visible. */
  visibleMarkets?: Set<string> | null;
  /** Called when user hovers a legend item (market name or null on leave). */
  onLegendHover?: (market: string | null) => void;
  /** Called when user clicks a legend item to toggle visibility. */
  onLegendClick?: (market: string) => void;
}

function applySeriesHighlightAndVisibility(
  seriesList: { name: string; series: { applyOptions: (o: { visible?: boolean; lineWidth?: number }) => void } }[],
  visibleMarkets: Set<string> | null | undefined,
  hoveredMarket: string | null | undefined
) {
  for (const { name, series } of seriesList) {
    const visible = visibleMarkets == null ? true : visibleMarkets.has(name);
    const lineWidth = hoveredMarket === name ? 4 : 2;
    series.applyOptions({ visible, lineWidth });
  }
}

export function DecibelFundingChart({
  rawData,
  className,
  maxSeries = 8,
  hoveredMarket = null,
  visibleMarkets = null,
  onLegendHover,
  onLegendClick,
}: DecibelFundingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  type ChartSeries = ReturnType<ReturnType<typeof createChart>['addSeries']>;
  const seriesListRef = useRef<{ name: string; series: ChartSeries }[]>([]);
  const [loading, setLoading] = useState(!rawData);
  const [error, setError] = useState<string | null>(null);
  const [internalData, setInternalData] = useState<RawFundingRecord[] | null>(null);

  const data = rawData !== undefined ? rawData : internalData;

  useEffect(() => {
    if (rawData !== undefined) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/protocols/decibel/funding')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.success || !Array.isArray(json.data)) {
          setError('Failed to load funding data');
          setInternalData(null);
          return;
        }
        setInternalData(json.data as RawFundingRecord[]);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setInternalData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rawData]);

  const seriesByMarket = useMemo(() => {
    if (!data || data.length === 0) return {};
    return groupByMarket(data);
  }, [data]);

  const marketOrder = useMemo(() => {
    const entries = Object.entries(seriesByMarket)
      .filter(([, points]) => points.length > 0)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, maxSeries)
      .map(([name]) => name);
    return entries;
  }, [seriesByMarket, maxSeries]);

  useEffect(() => {
    if (!containerRef.current || marketOrder.length === 0 || !data) return;

    const container = containerRef.current;
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderVisible: false },
    });
    chartRef.current = chart;

    const seriesList: { name: string; series: ReturnType<typeof chart.addSeries> }[] = [];
    let timeMin = Infinity;
    let timeMax = -Infinity;
    for (let i = 0; i < marketOrder.length; i++) {
      const name = marketOrder[i];
      const points = seriesByMarket[name];
      if (!points || points.length === 0) continue;
      const color = CHART_COLORS[i % CHART_COLORS.length];
      const lineSeries = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        title: name,
        lineType: LineType.Curved,
      });
      const smoothed = smoothSeries(points, 5);
      const chartData = smoothed.map((p) => {
        const t = Math.floor(p.time / 1000) || 0;
        if (t < timeMin) timeMin = t;
        if (t > timeMax) timeMax = t;
        return { time: t as UTCTimestamp, value: p.value };
      });
      lineSeries.setData(chartData);
      seriesList.push({ name, series: lineSeries });
    }
    seriesListRef.current = seriesList;
    applySeriesHighlightAndVisibility(seriesList, visibleMarkets, hoveredMarket);

    // Dedicated invisible series for the zero line (added after market series so it does not affect scale/order)
    if (Number.isFinite(timeMin) && Number.isFinite(timeMax)) {
      const zeroSeries = chart.addSeries(LineSeries, {
        color: 'transparent',
        lineWidth: 1,
        title: '',
        lineType: LineType.Curved,
      });
      zeroSeries.setData([
        { time: timeMin as UTCTimestamp, value: 0 },
        { time: timeMax as UTCTimestamp, value: 0 },
      ]);
      zeroSeries.createPriceLine({
        price: 0,
        color: 'rgba(200,200,200,0.95)',
        lineWidth: 4,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: '0',
      });
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesListRef.current = [];
    };
  }, [data, marketOrder, seriesByMarket]);

  useEffect(() => {
    const list = seriesListRef.current;
    if (list.length === 0) return;
    applySeriesHighlightAndVisibility(list, visibleMarkets, hoveredMarket);
  }, [hoveredMarket, visibleMarkets]);

  const isLoading = loading && !data;
  const hasError = error && !data;

  return (
    <div className={`relative flex flex-col min-h-0 ${className ?? 'w-full h-[320px]'}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-md z-10">
          <span className="text-sm text-muted-foreground">Loading chart…</span>
        </div>
      )}
      {hasError && (
        <div className="flex items-center justify-center flex-1 min-h-[120px] text-sm text-destructive">
          {error}
        </div>
      )}
      <div
        ref={containerRef}
        className={`w-full flex-1 min-h-0 ${hasError ? 'hidden' : ''}`}
      />
      {marketOrder.length > 0 && !hasError && (
        <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 pt-1.5 border-t border-border text-xs text-muted-foreground">
          {marketOrder.map((name, i) => {
            const visible = visibleMarkets == null ? true : visibleMarkets.has(name);
            const isHovered = hoveredMarket === name;
            const label = name.replace(/\/USD$/i, '');
            return (
              <span
                key={name}
                role="button"
                tabIndex={0}
                className={`inline-flex items-center gap-1.5 cursor-pointer select-none rounded px-1.5 py-0.5 transition-opacity ${
                  !visible ? 'opacity-40' : ''
                } ${isHovered ? 'ring-1 ring-primary rounded' : ''}`}
                style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}
                onMouseEnter={() => onLegendHover?.(name)}
                onMouseLeave={() => onLegendHover?.(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onLegendClick?.(name);
                  }
                }}
                onClick={() => onLegendClick?.(name)}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'currentColor' }} />
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
