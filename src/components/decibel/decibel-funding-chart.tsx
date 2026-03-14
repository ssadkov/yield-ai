'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  LineSeries,
  ColorType,
  LineType,
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
];

function groupByMarket(
  data: RawFundingRecord[]
): Record<string, { time: UTCTimestamp; value: number }[]> {
  const byMarket: Record<string, { time: number; value: number }[]> = {};
  for (const row of data) {
    const name = row.market_name;
    if (!name || typeof name !== 'string') continue;
    const bps = typeof row.funding_rate_bps === 'number' ? row.funding_rate_bps : 0;
    const positive = row.is_funding_positive === true || row.is_funding_positive === 1;
    const value = positive ? bps : -bps;
    const ts = typeof row.transaction_unix_ms === 'number' ? row.transaction_unix_ms : 0;
    const bucket = Math.floor(ts / BUCKET_MS) * BUCKET_MS;
    if (!byMarket[name]) byMarket[name] = [];
    const arr = byMarket[name];
    const last = arr[arr.length - 1];
    if (last && last.time === bucket) {
      last.value = value;
    } else {
      arr.push({ time: bucket, value });
    }
  }
  for (const key of Object.keys(byMarket)) {
    byMarket[key].sort((a, b) => a.time - b.time);
  }
  return byMarket as Record<string, { time: UTCTimestamp; value: number }[]>;
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
}

export function DecibelFundingChart({
  rawData,
  className,
  maxSeries = 8,
}: DecibelFundingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
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
      const chartData = smoothed.map((p) => ({
        time: (Math.floor(p.time / 1000) || 0) as UTCTimestamp,
        value: p.value,
      }));
      lineSeries.setData(chartData);
      seriesList.push({ name, series: lineSeries });
    }
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data, marketOrder, seriesByMarket]);

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
        <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
          {marketOrder.map((name, i) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5"
              style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'currentColor' }} />
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
