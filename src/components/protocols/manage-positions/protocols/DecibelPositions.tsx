'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Aptos, AptosConfig, Network, AccountAddress } from '@aptos-labs/ts-sdk';
import { normalizeAuthenticator } from '@/lib/hooks/useTransactionSubmitter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { formatNumber, formatCurrency } from '@/lib/utils/numberFormat';
import { normalizeAddress } from '@/lib/utils/addressNormalization';
import { cn } from '@/lib/utils';
import {
  buildCloseAtMarketPayload,
  type DecibelMarketConfig,
} from '@/lib/protocols/decibel/closePosition';

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

/** Decibel vault performance item (from account_vault_performance API, enriched with apr) */
export interface DecibelVaultItem {
  vault?: { name?: string };
  current_value_of_shares?: number;
  total_deposited?: number;
  /** APR as decimal (e.g. 0.15 = 15%), from API or derived from vault returns */
  apr?: number;
}

const DECIBEL_APP_URL = 'https://app.decibel.trade/';

/** Format position size with enough decimals for small amounts (e.g. 0.003706 BTC) */
function formatSize(size: number): string {
  const abs = Math.abs(size);
  if (abs === 0) return '0';
  if (abs < 0.0001) return size.toFixed(8);
  if (abs < 0.01) return size.toFixed(6);
  if (abs < 1) return size.toFixed(4);
  return formatNumber(size, 2);
}

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

/** Aptos client for direct submission (no Gas Station). Decibel close uses this to avoid Gas Station rules. */
function getDecibelAptosClient(network: 'testnet' | 'mainnet'): Aptos {
  const aptosNetwork = network === 'testnet' ? Network.TESTNET : Network.MAINNET;
  const config = new AptosConfig({ network: aptosNetwork });
  return new Aptos(config);
}

export function DecibelPositions() {
  const { account, signTransaction, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();
  const [positions, setPositions] = useState<DecibelPosition[]>([]);
  const [vaults, setVaults] = useState<DecibelVaultItem[]>([]);
  const [marketNames, setMarketNames] = useState<Record<string, string>>({});
  const [marketsMap, setMarketsMap] = useState<Record<string, DecibelMarketConfig>>({});
  const [decibelNetwork, setDecibelNetwork] = useState<'testnet' | 'mainnet'>('testnet');
  const [closingPositionKey, setClosingPositionKey] = useState<string | null>(null);
  const [closeConfirmPosition, setCloseConfirmPosition] = useState<DecibelPosition | null>(null);
  const [availableToTrade, setAvailableToTrade] = useState<number | null>(null);
  const [totalEquity, setTotalEquity] = useState<number | null>(null);
  const [preDepositSumUsdc, setPreDepositSumUsdc] = useState<number | null>(null);
  const [preDepositLoading, setPreDepositLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vaultsLoading, setVaultsLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [pricesMap, setPricesMap] = useState<Record<string, number>>({});
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
        `/api/protocols/decibel/userPositions?address=${encodeURIComponent(account.address.toString())}`
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
        `/api/protocols/decibel/accountVaultPerformance?address=${encodeURIComponent(account.address.toString())}`
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
        const nameMap: Record<string, string> = {};
        const configMap: Record<string, DecibelMarketConfig> = {};
        for (const m of data.data as (DecibelMarketConfig & { market_addr?: string; market_name?: string })[]) {
          const addr = m.market_addr;
          const name = m.market_name;
          if (addr != null) {
            const key = normalizeAddress(String(addr));
            if (name != null) nameMap[key] = String(name);
            configMap[key] = {
              market_addr: String(addr),
              market_name: m.market_name,
              px_decimals: m.px_decimals ?? 9,
              sz_decimals: m.sz_decimals ?? 9,
              tick_size: m.tick_size ?? 1_000_000,
              lot_size: m.lot_size ?? 100_000_000,
              min_size: m.min_size ?? 1_000_000_000,
            };
          }
        }
        setMarketNames(nameMap);
        setMarketsMap(configMap);
        if (data.network === 'mainnet' || data.network === 'testnet') {
          setDecibelNetwork(data.network);
        }
      }
    } catch {
      setMarketNames({});
      setMarketsMap({});
    }
  }, []);

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  const fetchOverview = useCallback(async () => {
    if (!account?.address) {
      setAvailableToTrade(null);
      setTotalEquity(null);
      return;
    }
    setOverviewLoading(true);
    try {
      const res = await fetch(
        `/api/protocols/decibel/accountOverview?address=${encodeURIComponent(account.address.toString())}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data as { usdc_cross_withdrawable_balance?: number; perp_equity_balance?: number };
        setAvailableToTrade(
          d.usdc_cross_withdrawable_balance != null ? Number(d.usdc_cross_withdrawable_balance) : null
        );
        setTotalEquity(
          d.perp_equity_balance != null ? Number(d.perp_equity_balance) : null
        );
      } else {
        setAvailableToTrade(null);
        setTotalEquity(null);
      }
    } catch {
      setAvailableToTrade(null);
      setTotalEquity(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [account?.address]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/protocols/decibel/prices');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const map: Record<string, number> = {};
        for (const item of data.data as { market?: string; mark_px?: number; mid_px?: number }[]) {
          const addr = item.market;
          if (addr != null) {
            const mark = item.mark_px ?? item.mid_px;
            if (typeof mark === 'number') map[normalizeAddress(String(addr))] = mark;
          }
        }
        setPricesMap(map);
      } else {
        setPricesMap({});
      }
    } catch {
      setPricesMap({});
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (positions.length > 0) fetchPrices();
  }, [positions.length, fetchPrices]);

  const fetchPreDeposit = useCallback(async () => {
    if (!account?.address) {
      setPreDepositSumUsdc(null);
      return;
    }
    setPreDepositLoading(true);
    try {
      const res = await fetch(
        `/api/protocols/decibel/predepositorBalance?address=${encodeURIComponent(account.address.toString())}`
      );
      const data = await res.json();
      if (data.success && typeof data.data?.sumUsdc === 'number') {
        setPreDepositSumUsdc(data.data.sumUsdc);
      } else {
        setPreDepositSumUsdc(0);
      }
    } catch {
      setPreDepositSumUsdc(null);
    } finally {
      setPreDepositLoading(false);
    }
  }, [account?.address]);

  useEffect(() => {
    fetchPreDeposit();
  }, [fetchPreDeposit]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ protocol: string; data?: DecibelPosition[] }>) => {
      if (e.detail?.protocol === 'decibel') {
        if (Array.isArray(e.detail.data)) {
          const active = e.detail.data.filter((p) => !p.is_deleted);
          setPositions(active);
        }
        fetchVaults();
        fetchOverview();
        fetchPreDeposit();
        fetchPrices();
      }
    };
    window.addEventListener('refreshPositions', handler as EventListener);
    return () => window.removeEventListener('refreshPositions', handler as EventListener);
  }, [fetchVaults, fetchOverview, fetchPreDeposit, fetchPrices]);

  const positionKey = (pos: DecibelPosition) => `${pos.market}-${pos.user}-${pos.size}-${pos.entry_price}`;

  const handleCloseClick = (pos: DecibelPosition) => {
    setCloseConfirmPosition(pos);
  };

  const handleConfirmClose = useCallback(async () => {
    const pos = closeConfirmPosition;
    if (!pos || (!signTransaction && !signAndSubmitTransaction) || !account?.address) {
      setCloseConfirmPosition(null);
      return;
    }
    const key = positionKey(pos);
    setClosingPositionKey(key);
    try {
      const pricesRes = await fetch(`/api/protocols/decibel/prices?market=${encodeURIComponent(pos.market)}`);
      const pricesData = await pricesRes.json();
      const pricesList = pricesData.success && Array.isArray(pricesData.data) ? pricesData.data : [];
      const priceItem = pricesList.find((p: { market?: string }) => normalizeAddress(p.market || '') === normalizeAddress(pos.market))
        ?? pricesList[0];
      const markPx = priceItem?.mark_px ?? priceItem?.mid_px ?? pos.entry_price;
      const marketKey = normalizeAddress(pos.market);
      const marketConfig =
        marketsMap[marketKey] ??
        Object.values(marketsMap).find((m) => normalizeAddress(m.market_addr || '') === marketKey);
      if (!marketConfig) {
        toast({ title: 'Error', description: 'Market config not found. Try refreshing.', variant: 'destructive' });
        setCloseConfirmPosition(null);
        setClosingPositionKey(null);
        return;
      }
      const payload = buildCloseAtMarketPayload({
        subaccountAddr: pos.user,
        marketAddr: pos.market,
        size: Math.abs(pos.size),
        isLong: pos.size > 0,
        markPx,
        marketConfig,
        slippageBps: 50,
        isTestnet: decibelNetwork === 'testnet',
      });

      let txHash: string;

      if (signAndSubmitTransaction) {
        // Primary path: wallet handles sign + submit (avoids normalizeAuthenticator/INVALID_AUTH_KEY)
        const result = await signAndSubmitTransaction({
          data: {
            function: payload.function as `${string}::${string}::${string}`,
            typeArguments: payload.typeArguments,
            functionArguments: payload.functionArguments as (string | number | boolean | Uint8Array | null)[],
          },
          options: { maxGasAmount: 20000 },
        });
        txHash = typeof result?.hash === 'string' ? result.hash : (result as { hash?: string })?.hash ?? '';
      } else if (signTransaction) {
        // Fallback: manual sign + submit (Decibel not in Gas Station rules)
        const aptos = getDecibelAptosClient(decibelNetwork);
        const senderAddr = AccountAddress.fromString(account.address.toString());
        const transaction = await aptos.transaction.build.simple({
          sender: senderAddr,
          data: {
            function: payload.function as `${string}::${string}::${string}`,
            typeArguments: payload.typeArguments,
            functionArguments: payload.functionArguments as (string | number | boolean | Uint8Array | null)[],
          },
          options: { maxGasAmount: 20000 },
        });
        console.log('[Decibel] sender:', senderAddr.toString(), 'wallet:', account?.address);
        const signResult = await signTransaction({ transactionOrPayload: transaction });
        console.log('[Decibel] signResult keys:', Object.keys(signResult ?? {}));
        const { authenticator } = signResult;
        const response = await aptos.transaction.submit.simple({
          transaction,
          senderAuthenticator: normalizeAuthenticator(authenticator),
        });
        txHash = typeof response?.hash === 'string' ? response.hash : (response as { hash?: string })?.hash ?? '';
      } else {
        throw new Error('Wallet does not support signing transactions');
      }
      toast({
        title: 'Position closed',
        description: txHash ? `Transaction ${txHash.slice(0, 6)}...${txHash.slice(-4)}` : 'Transaction submitted',
        action: txHash ? (
          <ToastAction
            altText="View in Explorer"
            onClick={() =>
              window.open(
                `https://explorer.aptoslabs.com/txn/${txHash}?network=${decibelNetwork === 'mainnet' ? 'mainnet' : 'testnet'}`,
                '_blank'
              )
            }
          >
            View in Explorer
          </ToastAction>
        ) : undefined,
      });
      setCloseConfirmPosition(null);
      fetchPositions();
    } catch (err: unknown) {
      const rawMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err);
      const testnetHint =
        decibelNetwork === 'testnet'
          ? ' Switch your wallet to Aptos Testnet and try again.'
          : '';
      const msg = rawMsg || 'Failed to close position';
      console.error('[Decibel] Close position error:', err);
      toast({
        title: 'Error',
        description: msg + testnetHint,
        variant: 'destructive',
      });
      setCloseConfirmPosition(null);
    } finally {
      setClosingPositionKey(null);
    }
  }, [closeConfirmPosition, signTransaction, signAndSubmitTransaction, account?.address, marketsMap, decibelNetwork, fetchPositions, toast]);

  const handleCancelClose = useCallback(() => {
    setCloseConfirmPosition(null);
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

  const vaultsTotal = vaults.reduce(
    (sum, v) => sum + (v.current_value_of_shares ?? 0),
    0
  );
  const totalAssets = (totalEquity ?? 0) + vaultsTotal + (preDepositSumUsdc ?? 0);
  const hasTestnetData = availableToTrade != null || positions.length > 0 || vaults.length > 0;

  return (
    <div className="space-y-6 text-base">
      {(preDepositSumUsdc != null && preDepositSumUsdc > 0) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Pre-deposit</span>
            <Badge variant="secondary" className="text-xs font-normal">
              mainnet
            </Badge>
          </div>
          <span className="font-medium">
            {preDepositLoading ? '…' : formatCurrency(preDepositSumUsdc ?? 0, 2)}
          </span>
        </div>
      )}
      {(availableToTrade != null || overviewLoading) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Available to trade</span>
            <Badge variant="secondary" className="text-xs font-normal">
              testnet
            </Badge>
            {hasTestnetData && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex text-muted-foreground cursor-help">
                      <Info className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px]">
                    <p>Decibel testnet funds (positions, available to trade, vaults) are not included in total assets.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <span className="font-medium">
            {overviewLoading ? '…' : formatCurrency(availableToTrade ?? 0, 2)}
          </span>
        </div>
      )}
      {positions.length === 0 && !vaultsLoading && vaults.length === 0 && (
        <p className="text-base text-muted-foreground py-2">
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
      )}
      {positions.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground">Positions</span>
            <Badge variant="secondary" className="text-xs font-normal">
              testnet
            </Badge>
            {hasTestnetData && (availableToTrade == null && !overviewLoading) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex text-muted-foreground cursor-help">
                      <Info className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px]">
                    <p>Decibel testnet funds (positions, available to trade, vaults) are not included in total assets.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <ul className="space-y-3">
            {positions.map((pos, i) => {
              const marketKey = normalizeAddress(pos.market);
              const marketName = marketNames[marketKey] ?? pos.market;
              const { base, quote, displayPair } = formatDecibelMarket(marketName);
              const showTokenLabels = base && quote && !pos.market.startsWith('0x');
              const notionalUsd = Math.abs(pos.size) * pos.entry_price;
              const marginUsd = pos.user_leverage && pos.user_leverage > 0
                ? notionalUsd / pos.user_leverage
                : notionalUsd;
              const markPx = pricesMap[marketKey] ?? pos.entry_price;
              const pricePnl = pos.size * (markPx - pos.entry_price);
              const fundingDisplay = -pos.unrealized_funding;
              const totalPnl = pricePnl + fundingDisplay;
              const pnlPercent = marginUsd > 0 ? (totalPnl / marginUsd) * 100 : 0;
              const isLong = pos.size > 0;
              const pnlColor = totalPnl > 0 ? 'text-green-600 dark:text-green-400' : totalPnl < 0 ? 'text-destructive' : 'text-muted-foreground';
              const pricePnlColor = pricePnl > 0 ? 'text-green-600 dark:text-green-400' : pricePnl < 0 ? 'text-destructive' : 'text-muted-foreground';
              const fundingColor = fundingDisplay > 0 ? 'text-green-600 dark:text-green-400' : fundingDisplay < 0 ? 'text-destructive' : 'text-muted-foreground';
              return (
                <li
                  key={`${pos.market}-${pos.user}-${i}`}
                  className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
                >
                  {/* Top: pair info | Total PnL, Margin, Close */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium">{displayPair}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-medium shrink-0',
                          isLong ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                        )}
                      >
                        {isLong ? 'Long' : 'Short'}
                      </Badge>
                      <span className="text-sm text-muted-foreground shrink-0">{pos.user_leverage}x</span>
                      {pos.is_isolated && (
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                          Isolated
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-auto">
                      <span className={cn('text-2xl font-semibold text-right', pnlColor)}>
                        {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl, 2)}
                      </span>
                      <span className={cn('text-lg font-medium text-right', pnlColor)}>
                        ({pnlPercent >= 0 ? '+' : ''}{formatNumber(pnlPercent, 2)}%)
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-muted-foreground mt-1 cursor-help">
                              Margin: {formatCurrency(marginUsd, 2)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-[220px]">
                            <p>Initial margin (collateral at risk) = Notional ÷ Leverage. Used for % PnL and liquidation.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-2 self-end"
                        onClick={() => handleCloseClick(pos)}
                        disabled={!!closingPositionKey}
                      >
                        {closingPositionKey === positionKey(pos) ? 'Closing…' : 'Close'}
                      </Button>
                    </div>
                  </div>
                  {/* PnL breakdown below, with horizontal line */}
                  <div className="mt-2 pt-2 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Est. PnL (price):</span>
                    <span className={pricePnlColor}>{pricePnl >= 0 ? '+' : ''}{formatCurrency(pricePnl, 2)}</span>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-muted-foreground">Funding:</span>
                    <span className={fundingColor}>{fundingDisplay >= 0 ? '+' : ''}{formatCurrency(fundingDisplay, 2)}</span>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-muted-foreground">Total:</span>
                    <span className={pnlColor}>{totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl, 2)}</span>
                  </div>
                  {/* Details: Entry, Mark, Liq. price, Size, Value — compact, no extra gap */}
                  <div className="mt-2 pt-2 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Entry price</span>
                      <span className="ml-2">
                        {formatNumber(pos.entry_price)}
                        {showTokenLabels ? ` ${quote}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mark price</span>
                      <span className="ml-2">
                        {formatNumber(markPx)}
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
                      <span className="text-muted-foreground">
                        {showTokenLabels ? `Size (${base})` : 'Size'}
                      </span>
                      <span className="ml-2">
                        {formatSize(pos.size)}
                        {showTokenLabels ? ` ${base}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Value (USD)</span>
                      <span className="ml-2 font-medium">{formatCurrency(notionalUsd, 2)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Dialog open={!!closeConfirmPosition} onOpenChange={(open) => !open && handleCancelClose()}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Close position</DialogTitle>
                <DialogDescription>
                  {closeConfirmPosition && (
                    <>
                      Close {formatSize(Math.abs(closeConfirmPosition.size))}{' '}
                      {formatDecibelMarket(marketNames[normalizeAddress(closeConfirmPosition.market)] ?? closeConfirmPosition.market).displayPair}{' '}
                      at market price? This will execute immediately (IOC).
                      {decibelNetwork === 'testnet' && (
                        <span className="mt-2 block text-amber-600 dark:text-amber-400 font-medium">
                          Switch your wallet to Aptos Testnet before closing.
                        </span>
                      )}
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={handleCancelClose} disabled={!!closingPositionKey}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmClose}
                  disabled={!!closingPositionKey || !closeConfirmPosition}
                >
                  {closingPositionKey ? 'Closing…' : 'Close at market'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Vaults: show when we have vault deposits */}
      {(vaultsLoading || vaults.length > 0) && (
        <div className="space-y-2">
          <h4 className="text-base font-medium mb-2 text-muted-foreground flex items-center gap-2">
            Vaults
            <Badge variant="secondary" className="text-xs font-normal">
              testnet
            </Badge>
            {hasTestnetData && (availableToTrade == null && !overviewLoading) && positions.length === 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex text-muted-foreground cursor-help">
                      <Info className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px]">
                    <p>Decibel testnet funds (positions, available to trade, vaults) are not included in total assets.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </h4>
          {vaultsLoading ? (
            <p className="text-base text-muted-foreground">Loading vaults...</p>
          ) : vaults.length === 0 ? (
            <p className="text-base text-muted-foreground">No vault deposits.</p>
          ) : (
            <ul className="space-y-2">
              {vaults.map((v, i) => (
                <li
                  key={i}
                  className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 py-1">
                    <div className="min-w-0 text-base font-medium">{v.vault?.name ?? 'Vault'}</div>
                    <div className="shrink-0 text-right text-base font-medium">
                      {v.current_value_of_shares != null
                        ? formatCurrency(v.current_value_of_shares, 2)
                        : '—'}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-muted-foreground">
                    {v.total_deposited != null && (
                      <span>Deposited: {formatCurrency(v.total_deposited, 2)}</span>
                    )}
                    {v.apr != null && Number.isFinite(v.apr) && (
                      <Badge
                        variant="outline"
                        className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-2 py-0.5 h-5"
                      >
                        APR: {(v.apr * 100).toFixed(2)}%
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex items-center justify-between pt-6 pb-6">
        <span className="text-lg">Total assets in Decibel:</span>
        <span className="text-lg font-bold text-primary">{formatCurrency(totalAssets, 2)}</span>
      </div>
    </div>
  );
}
