'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, ColorType, LineStyle, type UTCTimestamp } from 'lightweight-charts';

/** Decibel candlestick item: t (open time ms), o, h, l, c, v, i */
interface DecibelCandle {
  t: number;
  T?: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
  i?: string;
}

const DEFAULT_INTERVAL = '1h';
const DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

/** Limit order to show as a horizontal price line on the chart (price in human form) */
export interface DecibelChartLimitOrder {
  price: number;
  reduceOnly?: boolean;
}

interface DecibelChartProps {
  marketAddr: string;
  interval?: string;
  startTime?: number;
  endTime?: number;
  /** Limit orders to draw as price lines (e.g. open orders). Price in human form. */
  limitOrders?: DecibelChartLimitOrder[];
  /** Position entry prices to draw as price lines (human form). */
  entryPrices?: number[];
  className?: string;
}

export function DecibelChart({
  marketAddr,
  interval = DEFAULT_INTERVAL,
  startTime: startTimeProp,
  endTime: endTimeProp,
  limitOrders = [],
  entryPrices = [],
  className,
}: DecibelChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketAddr || !containerRef.current) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Compute range inside effect so we don't depend on Date.now() and re-run every render
    const endTime = endTimeProp ?? Date.now();
    const startTime = startTimeProp ?? endTime - DEFAULT_RANGE_MS;

    const params = new URLSearchParams({
      market: marketAddr,
      interval,
      startTime: String(startTime),
      endTime: String(endTime),
    });
    fetch(`/api/protocols/decibel/candlesticks?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.success || !Array.isArray(json.data)) {
          setError('Failed to load candlestick data');
          setLoading(false);
          return;
        }
        const raw = json.data as DecibelCandle[];
        const data = raw.map((c) => ({
          time: Math.floor(c.t / 1000) as UTCTimestamp,
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
        }));

        if (data.length === 0) {
          setError('No candle data');
          setLoading(false);
          return;
        }

        const container = containerRef.current;
        if (!container) return;

        const chart = createChart(container, {
          autoSize: true,
          layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#888' },
          grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
          timeScale: { timeVisible: true, secondsVisible: false },
        });
        chartRef.current = chart;

        const series = chart.addSeries(CandlestickSeries, {
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: true,
          borderUpColor: '#22c55e',
          borderDownColor: '#ef4444',
        });
        series.setData(data);
        chart.timeScale().fitContent();

        // Draw limit order price lines (open orders)
        for (const order of limitOrders) {
          if (!Number.isFinite(order.price) || order.price <= 0) continue;
          series.createPriceLine({
            price: order.price,
            color: order.reduceOnly ? '#f59e0b' : '#3b82f6',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: order.reduceOnly ? 'Limit close' : 'Limit',
          });
        }
        // Draw position entry price lines
        for (const entry of entryPrices) {
          if (!Number.isFinite(entry) || entry <= 0) continue;
          series.createPriceLine({
            price: entry,
            color: '#6b7280',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'Entry',
          });
        }

        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chart');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (chartRef.current && containerRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
    // Re-run when market, interval, or overlay data (orders/entries) change
  }, [marketAddr, interval, limitOrders, entryPrices]);

  return (
    <div className={`relative ${className ?? 'w-full h-[300px]'}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-md z-10">
          <span className="text-sm text-muted-foreground">Loading chart…</span>
        </div>
      )}
      {error && !loading && (
        <div className="flex items-center justify-center h-full min-h-[200px] text-sm text-destructive">
          {error}
        </div>
      )}
      <div
        ref={containerRef}
        className={`w-full h-full min-h-[200px] ${error ? 'hidden' : ''}`}
      />
    </div>
  );
}
