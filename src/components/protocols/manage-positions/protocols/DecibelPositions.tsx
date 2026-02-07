'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { formatNumber, formatCurrency } from '@/lib/utils/numberFormat';
import { normalizeAddress } from '@/lib/utils/addressNormalization';

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

/** Shorten hex address for display */
function shortenHex(hex: string, head = 6, tail = 4): string {
  if (!hex || !hex.startsWith('0x') || hex.length <= head + tail + 2) return hex;
  return `${hex.slice(0, head + 2)}…${hex.slice(-tail)}`;
}

/** Parse market symbol (e.g. "BTC-USDC") into base and quote for labels; returns market as-is if not symbol-like */
function formatDecibelMarket(marketName: string): { base: string; quote: string; displayPair: string } {
  const s = (marketName || '').trim();
  if (!s || s.startsWith('0x') || !s.includes('-')) {
    const display = s.startsWith('0x') ? shortenHex(s) : s || '—';
    return { base: s || '—', quote: '', displayPair: display };
  }
  const parts = s.split('-');
  const base = parts[0]?.toUpperCase() || s;
  const quote = parts[1]?.toUpperCase() || '';
  return { base, quote, displayPair: quote ? `${base}-${quote}` : base };
}

export function DecibelPositions() {
  const { account } = useWallet();
  const { toast } = useToast();
  const [positions, setPositions] = useState<DecibelPosition[]>([]);
  const [vaults, setVaults] = useState<DecibelVaultItem[]>([]);
  const [marketNames, setMarketNames] = useState<Record<string, string>>({});
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

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/protocols/decibel/markets');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const map: Record<string, string> = {};
        for (const m of data.data as { market_addr?: string; market_name?: string }[]) {
          const addr = m.market_addr;
          const name = m.market_name;
          if (addr != null && name != null) {
            map[normalizeAddress(String(addr))] = String(name);
          }
        }
        setMarketNames(map);
      }
    } catch {
      setMarketNames({});
    }
  }, []);

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

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
              const marketKey = normalizeAddress(pos.market);
              const marketName = marketNames[marketKey] ?? pos.market;
              const { base, quote, displayPair } = formatDecibelMarket(marketName);
              const showTokenLabels = base && quote && !pos.market.startsWith('0x');
              return (
                <li
                  key={`${pos.market}-${pos.user}-${i}`}
                  className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{displayPair}</span>
                    {pos.is_isolated && (
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        Isolated
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        {showTokenLabels ? `Size (${base})` : 'Size'}
                      </span>
                      <span className="ml-2">
                        {formatNumber(pos.size)}
                        {showTokenLabels ? ` ${base}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Entry price</span>
                      <span className="ml-2">
                        {formatNumber(pos.entry_price)}
                        {showTokenLabels ? ` ${quote}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Liq. price</span>
                      <span className="ml-2">
                        {formatNumber(pos.estimated_liquidation_price)}
                        {showTokenLabels ? ` ${quote}` : ''}
                      </span>
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
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Vaults</h4>
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
                  <div className="flex items-center justify-between py-1">
                    <div className="text-sm font-medium">{v.vault?.name ?? 'Vault'}</div>
                    <div className="text-sm font-medium">
                      {v.current_value_of_shares != null
                        ? formatCurrency(v.current_value_of_shares, 2)
                        : '—'}
                    </div>
                  </div>
                  {v.total_deposited != null && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      Deposited: {formatCurrency(v.total_deposited, 2)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
