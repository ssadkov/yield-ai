'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ExternalLink } from 'lucide-react';
import { formatNumber } from '@/lib/utils/numberFormat';

/** Decibel API position shape (snake_case from API) */
export interface DecibelPosition {
  market: string;
  size: number;
  entry_price: number;
  estimated_liquidation_price: number;
  unrealized_funding: number;
  user: string;
  user_leverage: number;
  is_isolated: boolean;
  is_deleted?: boolean;
  sl_limit_price?: number | null;
  sl_trigger_price?: number | null;
  tp_limit_price?: number | null;
  tp_trigger_price?: number | null;
}

const DECIBEL_APP_URL = 'https://trade.decibel.exchange';

export function DecibelPositions() {
  const { account } = useWallet();
  const { toast } = useToast();
  const [positions, setPositions] = useState<DecibelPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!account?.address) {
      setPositions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/protocols/decibel/userPositions?address=${encodeURIComponent(account.address)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Request failed: ${res.status}`);
        setPositions([]);
        return;
      }
      if (data.success && Array.isArray(data.data)) {
        const active = (data.data as DecibelPosition[]).filter((p) => !p.is_deleted);
        setPositions(active);
      } else {
        setPositions([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load positions';
      setError(msg);
      setPositions([]);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [account?.address, toast]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ protocol: string; data?: DecibelPosition[] }>) => {
      if (e.detail?.protocol === 'decibel' && Array.isArray(e.detail.data)) {
        const active = e.detail.data.filter((p) => !p.is_deleted);
        setPositions(active);
      }
    };
    window.addEventListener('refreshPositions', handler as EventListener);
    return () => window.removeEventListener('refreshPositions', handler as EventListener);
  }, []);

  if (!account?.address) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Connect your Aptos wallet to view Decibel positions.
      </div>
    );
  }

  if (loading) {
    return <div className="py-4 text-muted-foreground">Loading Decibel positions...</div>;
  }

  if (error) {
    return (
      <div className="py-4 space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchPositions}>
          Retry
        </Button>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="py-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          No open positions on Decibel. Open positions at{' '}
          <a
            href={DECIBEL_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            trade.decibel.exchange
          </a>
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={DECIBEL_APP_URL} target="_blank" rel="noopener noreferrer">
            Open in Decibel
            <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {positions.length} position{positions.length !== 1 ? 's' : ''}
        </span>
        <Button variant="outline" size="sm" asChild>
          <a href={DECIBEL_APP_URL} target="_blank" rel="noopener noreferrer">
            Open in Decibel
            <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
      </div>
      <ul className="space-y-3">
        {positions.map((pos, i) => (
          <li
            key={`${pos.market}-${pos.user}-${i}`}
            className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{pos.market}</span>
              {pos.is_isolated && (
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  Isolated
                </span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Size</span>
                <span className="ml-2">{formatNumber(pos.size)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Entry price</span>
                <span className="ml-2">{formatNumber(pos.entry_price)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Liq. price</span>
                <span className="ml-2">{formatNumber(pos.estimated_liquidation_price)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Unrealized funding</span>
                <span className="ml-2">{formatNumber(pos.unrealized_funding)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Leverage</span>
                <span className="ml-2">{pos.user_leverage}x</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
