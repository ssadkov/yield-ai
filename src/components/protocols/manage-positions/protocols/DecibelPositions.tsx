'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { formatNumber, formatCurrency } from '@/lib/utils/numberFormat';

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

/** Decibel vault performance item (from account_vault_performance API) */
export interface DecibelVaultItem {
  vault?: { name?: string };
  current_value_of_shares?: number;
  total_deposited?: number;
}

const DECIBEL_APP_URL = 'https://app.decibel.trade/';

/** Parse Decibel market string (e.g. "BTC-USDC", "BTC-USD") into base and quote for display */
function formatDecibelMarket(market: string): { base: string; quote: string; pair: string } {
  const parts = (market || '').split('-');
  const base = parts[0]?.toUpperCase() || market;
  const quote = parts[1]?.toUpperCase() || '';
  return { base, quote, pair: quote ? `${base} / ${quote}` : base };
}

export function DecibelPositions() {
  const { account } = useWallet();
  const { toast } = useToast();
  const [positions, setPositions] = useState<DecibelPosition[]>([]);
  const [vaults, setVaults] = useState<DecibelVaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [vaultsLoading, setVaultsLoading] = useState(false);
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

  const fetchVaults = useCallback(async () => {
    if (!account?.address) {
      setVaults([]);
      return;
    }
    setVaultsLoading(true);
    try {
      const res = await fetch(
        `/api/protocols/decibel/accountVaultPerformance?address=${encodeURIComponent(account.address)}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setVaults(data.data as DecibelVaultItem[]);
      } else {
        setVaults([]);
      }
    } catch {
      setVaults([]);
    } finally {
      setVaultsLoading(false);
    }
  }, [account?.address]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

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

  if (positions.length === 0 && !vaultsLoading && vaults.length === 0) {
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
            app.decibel.trade
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {positions.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {positions.length} position{positions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-3">
            {positions.map((pos, i) => {
              const { base, quote, pair } = formatDecibelMarket(pos.market);
              return (
                <li
                  key={`${pos.market}-${pos.user}-${i}`}
                  className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{pair}</span>
                    {pos.is_isolated && (
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        Isolated
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Size ({base})</span>
                      <span className="ml-2">{formatNumber(pos.size)} {base}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Entry price</span>
                      <span className="ml-2">{formatNumber(pos.entry_price)} {quote}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Liq. price</span>
                      <span className="ml-2">{formatNumber(pos.estimated_liquidation_price)} {quote}</span>
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
              );
            })}
          </ul>
        </>
      )}

      {/* Vaults: show when we have vault deposits */}
      {(vaultsLoading || vaults.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Vaults</span>
          </div>
          {vaultsLoading ? (
            <p className="text-sm text-muted-foreground">Loading vaults...</p>
          ) : vaults.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vault deposits.</p>
          ) : (
            <ul className="space-y-2">
              {vaults.map((v, i) => (
                <li
                  key={i}
                  className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm"
                >
                  <div className="font-medium">{v.vault?.name ?? 'Vault'}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {v.current_value_of_shares != null && (
                      <span>Current value: {formatCurrency(v.current_value_of_shares)}</span>
                    )}
                    {v.total_deposited != null && (
                      <span>Deposited: {formatCurrency(v.total_deposited)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
