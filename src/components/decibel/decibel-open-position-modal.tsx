'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DecibelChart } from './decibel-chart';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/numberFormat';
import { normalizeAddress } from '@/lib/utils/addressNormalization';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
  buildOpenMarketOrderPayload,
  type DecibelMarketConfig,
} from '@/lib/protocols/decibel/closePosition';

export interface DecibelOpenPositionMarket {
  marketAddr: string;
  marketName: string;
  /** Optional logo URL for the market (e.g. BTC/USD, APT/USD). */
  marketLogoUrl?: string;
}

/** Intervals supported by Decibel candlesticks API (and our proxy). 1m excluded from selector. */
export const CHART_INTERVALS = [
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '2h', label: '2h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1mo', label: '1M' },
] as const;

const ORDER_TYPE_MARKET = 'market';

interface DecibelOpenPositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market: DecibelOpenPositionMarket | null;
}

export function DecibelOpenPositionModal({
  open,
  onOpenChange,
  market,
}: DecibelOpenPositionModalProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();
  const [chartInterval, setChartInterval] = useState<string>('1h');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [orderSizeUsd, setOrderSizeUsd] = useState('');
  const [availableToTrade, setAvailableToTrade] = useState<number | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [builderConfig, setBuilderConfig] = useState<{
    builderAddress: string;
    builderFeeBps: number;
  } | null>(null);
  const [subaccountAddr, setSubaccountAddr] = useState<string | null>(null);
  const [marketConfig, setMarketConfig] = useState<DecibelMarketConfig | null>(null);
  const [markPx, setMarkPx] = useState<number | null>(null);
  const [decibelNetwork, setDecibelNetwork] = useState<'mainnet' | 'testnet'>('mainnet');
  const [placing, setPlacing] = useState(false);

  const fetchOverview = useCallback(async () => {
    if (!account?.address || !open) {
      setAvailableToTrade(null);
      return;
    }
    setOverviewLoading(true);
    try {
      const res = await fetch(
        `/api/protocols/decibel/accountOverview?address=${encodeURIComponent(account.address.toString())}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data as { usdc_cross_withdrawable_balance?: number };
        setAvailableToTrade(
          d.usdc_cross_withdrawable_balance != null
            ? Number(d.usdc_cross_withdrawable_balance)
            : null
        );
      } else {
        setAvailableToTrade(null);
      }
    } catch {
      setAvailableToTrade(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [account?.address, open]);

  useEffect(() => {
    if (!open) return;
    fetchOverview();
  }, [open, fetchOverview]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch('/api/protocols/decibel/builder-config')
      .then((r) => r.json())
      .then((data: { success?: boolean; builderAddress?: string; builderFeeBps?: number }) => {
        if (cancelled) return;
        if (
          data?.success &&
          data.builderAddress &&
          typeof data.builderFeeBps === 'number'
        ) {
          setBuilderConfig({
            builderAddress: data.builderAddress,
            builderFeeBps: data.builderFeeBps,
          });
        } else {
          setBuilderConfig(null);
        }
      })
      .catch(() => {
        if (!cancelled) setBuilderConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !account?.address) {
      setSubaccountAddr(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/protocols/decibel/subaccounts?address=${encodeURIComponent(account.address.toString())}`)
      .then((r) => r.json())
      .then((data: { success?: boolean; data?: { subaccount_address?: string; is_primary?: boolean }[] }) => {
        if (cancelled) return;
        const list = data?.success && Array.isArray(data.data) ? data.data : [];
        const primary = list.find((s) => s.is_primary) ?? list[0];
        setSubaccountAddr(primary?.subaccount_address ?? null);
      })
      .catch(() => {
        if (!cancelled) setSubaccountAddr(null);
      });
    return () => { cancelled = true; };
  }, [open, account?.address]);

  useEffect(() => {
    if (!open || !market) {
      setMarketConfig(null);
      setDecibelNetwork('mainnet');
      return;
    }
    let cancelled = false;
    fetch('/api/protocols/decibel/markets')
      .then((r) => r.json())
      .then((data: { success?: boolean; data?: (DecibelMarketConfig & { market_addr?: string })[]; network?: string }) => {
        if (cancelled) return;
        const list = data?.success && Array.isArray(data.data) ? data.data : [];
        const key = normalizeAddress(market.marketAddr);
        const m = list.find((x) => normalizeAddress(String(x.market_addr || '')) === key);
        if (m) {
          setMarketConfig({
            market_addr: m.market_addr,
            market_name: m.market_name,
            px_decimals: Number(m.px_decimals) || 9,
            sz_decimals: Number(m.sz_decimals) || 9,
            tick_size: Number(m.tick_size) || 1_000_000,
            lot_size: Number(m.lot_size) || 100_000_000,
            min_size: Number(m.min_size) || 1_000_000_000,
          });
        } else {
          setMarketConfig(null);
        }
        if (data.network === 'mainnet' || data.network === 'testnet') setDecibelNetwork(data.network);
      })
      .catch(() => {
        if (!cancelled) setMarketConfig(null);
      });
    return () => { cancelled = true; };
  }, [open, market?.marketAddr]);

  useEffect(() => {
    if (!open || !market) {
      setMarkPx(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/protocols/decibel/prices?market=${encodeURIComponent(market.marketAddr)}`)
      .then((r) => r.json())
      .then((data: { success?: boolean; data?: { mark_px?: number }[] }) => {
        if (cancelled) return;
        const list = data?.success && Array.isArray(data.data) ? data.data : [];
        const first = list[0];
        setMarkPx(typeof first?.mark_px === 'number' ? first.mark_px : null);
      })
      .catch(() => {
        if (!cancelled) setMarkPx(null);
      });
    return () => { cancelled = true; };
  }, [open, market?.marketAddr]);

  const orderSizeNum = orderSizeUsd.trim() === '' ? NaN : parseFloat(orderSizeUsd);
  const isValidSize =
    Number.isFinite(orderSizeNum) &&
    orderSizeNum > 0 &&
    (availableToTrade == null || orderSizeNum <= availableToTrade);

  const handlePlaceOrder = useCallback(async () => {
    if (
      !market ||
      !account?.address ||
      !subaccountAddr ||
      !marketConfig ||
      markPx == null ||
      markPx <= 0 ||
      !signAndSubmitTransaction ||
      !isValidSize
    ) {
      toast({
        title: 'Cannot place order',
        description: 'Missing subaccount, market config, or mark price. Try refreshing.',
        variant: 'destructive',
      });
      return;
    }
    setPlacing(true);
    try {
      const payload = buildOpenMarketOrderPayload({
        subaccountAddr,
        marketAddr: market.marketAddr,
        orderSizeUsd: orderSizeNum,
        markPx,
        marketConfig,
        isLong: side === 'long',
        slippageBps: 50,
        isTestnet: decibelNetwork === 'testnet',
        builderAddr: builderConfig?.builderAddress ?? undefined,
        builderFeeBps: builderConfig?.builderFeeBps ?? undefined,
      });
      const result = await signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.typeArguments,
          functionArguments: payload.functionArguments as (string | number | boolean | bigint | null)[],
        },
        options: { maxGasAmount: 20000 },
      });
      const txHash = typeof result?.hash === 'string' ? result.hash : (result as { hash?: string })?.hash ?? '';
      const baseName = market.marketName?.split('/')[0] ?? 'Position';
      toast({
        title: 'Order placed',
        description: txHash
          ? `${baseName} ${side} order submitted. Tx: ${txHash.slice(0, 8)}...${txHash.slice(-6)}`
          : 'Order submitted',
        action: txHash ? (
          <ToastAction
            altText="View in Explorer"
            onClick={() =>
              window.open(
                `https://explorer.aptoslabs.com/txn/${txHash}?network=${decibelNetwork}`,
                '_blank'
              )
            }
          >
            View in Explorer
          </ToastAction>
        ) : undefined,
      });
      setOrderSizeUsd('');
      fetchOverview();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRejected = /reject|denied|cancel/i.test(msg);
      toast({
        title: isRejected ? 'Order cancelled' : 'Order failed',
        description: isRejected ? 'You rejected the transaction.' : msg,
        variant: 'destructive',
      });
    } finally {
      setPlacing(false);
    }
  }, [
    market,
    account?.address,
    subaccountAddr,
    marketConfig,
    markPx,
    signAndSubmitTransaction,
    orderSizeNum,
    side,
    decibelNetwork,
    builderConfig,
    isValidSize,
    toast,
    fetchOverview,
  ]);

  const canPlace =
    !!market &&
    !!account?.address &&
    !!subaccountAddr &&
    !!marketConfig &&
    markPx != null &&
    markPx > 0 &&
    isValidSize &&
    !placing;

  const truncateAddress = (addr: string) => {
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-hidden flex flex-col p-3 sm:p-4 rounded-2xl [&>button:last-child]:hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {market?.marketLogoUrl && (
                <div className="w-8 h-8 sm:w-9 sm:h-9 relative shrink-0 rounded-full overflow-hidden bg-muted">
                  <Image
                    src={market.marketLogoUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="object-contain"
                    unoptimized
                  />
                </div>
              )}
              <DialogTitle className="truncate">
                {market ? `Trade — ${market.marketName}` : 'Trade'}
              </DialogTitle>
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_minmax(320px,380px)] gap-4 overflow-auto">
          {/* Left: chart + interval */}
          {market && (
            <div className="flex flex-col min-h-0 gap-3">
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Label className="text-muted-foreground">Interval</Label>
                <Select
                  value={chartInterval}
                  onValueChange={setChartInterval}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHART_INTERVALS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-h-[240px] sm:min-h-[280px] lg:min-h-0">
                <DecibelChart
                  marketAddr={market.marketAddr}
                  interval={chartInterval}
                  className="w-full h-full min-h-[240px] sm:min-h-[280px] lg:min-h-[300px]"
                />
              </div>
            </div>
          )}

          {/* Right: open position form */}
          <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shrink-0 lg:shrink overflow-auto">
            <p className="text-sm font-medium text-muted-foreground">
              Open position
            </p>

            {/* Available to trade */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available to trade</span>
              <span className="font-medium">
                {overviewLoading
                  ? '…'
                  : availableToTrade != null
                    ? `${formatCurrency(availableToTrade, 2)} USDC`
                    : account?.address
                      ? '—'
                      : 'Connect wallet'}
              </span>
            </div>

            {/* Long / Short */}
            <div className="space-y-2">
              <Label>Side</Label>
              <div className="flex gap-1 p-0.5 rounded-lg border bg-muted/40">
                <button
                  type="button"
                  onClick={() => setSide('long')}
                  className={cn(
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    side === 'long'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Long
                </button>
                <button
                  type="button"
                  onClick={() => setSide('short')}
                  className={cn(
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    side === 'short'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Short
                </button>
              </div>
            </div>

            {/* Order type (Market only) + Leverage 1x in one row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Order type</Label>
                <Select value={ORDER_TYPE_MARKET}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ORDER_TYPE_MARKET}>Market</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Leverage</Label>
                <div className="flex gap-1 p-0.5 rounded-lg border bg-muted/40">
                  <span className="flex-1 rounded-md px-3 py-2 text-sm font-medium bg-background text-foreground shadow-sm text-center">
                    1x
                  </span>
                </div>
              </div>
            </div>

            {/* Order size USD */}
            <div className="space-y-2">
              <Label htmlFor="order-size-usd">Order size (USD)</Label>
              <Input
                id="order-size-usd"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={orderSizeUsd}
                onChange={(e) => setOrderSizeUsd(e.target.value)}
                className="font-mono"
              />
              {availableToTrade != null && orderSizeNum > availableToTrade && (
                <p className="text-xs text-destructive">
                  Cannot exceed available {formatCurrency(availableToTrade, 2)}
                </p>
              )}
            </div>

            {/* Place order button + builder fee/address */}
            <div className="space-y-2 pt-2">
              <Button
                className="w-full"
                size="lg"
                disabled={!canPlace}
                onClick={handlePlaceOrder}
              >
                {placing
                  ? 'Placing…'
                  : `Place ${market?.marketName?.split('/')[0] ?? 'order'} order`}
              </Button>
              {builderConfig && (
                <p className="text-xs text-muted-foreground text-center">
                  Builder fee: {(builderConfig.builderFeeBps / 100).toFixed(2)}%
                  {builderConfig.builderAddress && (
                    <> · {truncateAddress(builderConfig.builderAddress)}</>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
