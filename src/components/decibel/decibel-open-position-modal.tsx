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
  DialogDescription,
  DialogFooter,
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
import { formatCurrency, formatNumber } from '@/lib/utils/numberFormat';
import { normalizeAddress } from '@/lib/utils/addressNormalization';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
  buildOpenMarketOrderPayload,
  buildCloseAtMarketPayload,
  buildCloseAtLimitPayload,
  buildCancelOrderPayload,
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

/** Minimal position shape from Decibel userPositions API */
interface DecibelPositionRow {
  market: string;
  size: number;
  entry_price: number;
  user: string;
  is_deleted?: boolean;
}

/** Minimal open order shape from Decibel open_orders API */
interface DecibelOrderRow {
  market?: string;
  market_address?: string;
  price: number;
  orig_size?: number;
  remaining_size?: number;
  reduce_only?: boolean;
  is_reduce_only?: boolean;
  order_id?: string;
}

function normalizeOrdersData(data: unknown): DecibelOrderRow[] {
  if (Array.isArray(data)) return data as DecibelOrderRow[];
  if (data && typeof data === 'object' && 'items' in data && Array.isArray((data as { items: unknown }).items)) {
    return (data as { items: DecibelOrderRow[] }).items;
  }
  return [];
}

function formatSizeShort(size: number): string {
  const abs = Math.abs(size);
  if (abs === 0) return '0';
  if (abs < 0.0001) return size.toFixed(6);
  if (abs < 0.01) return size.toFixed(4);
  if (abs < 1) return size.toFixed(4);
  return formatNumber(size, 2);
}

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
  const [marketPositions, setMarketPositions] = useState<DecibelPositionRow[]>([]);
  const [marketOrders, setMarketOrders] = useState<DecibelOrderRow[]>([]);
  const [positionsOrdersLoading, setPositionsOrdersLoading] = useState(false);
  const [closeDialogPosition, setCloseDialogPosition] = useState<DecibelPositionRow | null>(null);
  const [closingPosition, setClosingPosition] = useState(false);
  const [closeMode, setCloseMode] = useState<'market' | 'limit'>('market');
  const [closeLimitPrice, setCloseLimitPrice] = useState('');
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);

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

  const fetchPositionsAndOrders = useCallback(async () => {
    if (!open || !account?.address || !market) {
      setMarketPositions([]);
      setMarketOrders([]);
      return;
    }
    const marketKey = normalizeAddress(market.marketAddr);
    setPositionsOrdersLoading(true);
    try {
      const [posRes, orderRes] = await Promise.all([
        fetch(`/api/protocols/decibel/userPositions?address=${encodeURIComponent(account.address.toString())}`),
        fetch(
          `/api/protocols/decibel/openOrders?address=${encodeURIComponent(
            (subaccountAddr || account.address).toString()
          )}`
        ),
      ]);
      const posData = await posRes.json();
      const orderData = await orderRes.json();
      const allPositions: DecibelPositionRow[] =
        posData?.success && Array.isArray(posData.data) ? posData.data : [];
      const activePositions = allPositions.filter(
        (p) => !p.is_deleted && normalizeAddress(p.market) === marketKey
      );
      setMarketPositions(activePositions);
      const allOrders = normalizeOrdersData(orderData?.data);
      const marketOrdersFiltered = allOrders.filter(
        (o) => normalizeAddress(o.market ?? o.market_address ?? '') === marketKey
      );
      // Exclude invalid/stale orders: zero price or zero remaining size (filled/cancelled)
      const validOrders = marketOrdersFiltered.filter((o) => {
        if (o.price <= 0 || !Number.isFinite(o.price)) return false;
        const remaining = o.remaining_size ?? o.orig_size;
        if (remaining != null && remaining <= 0) return false;
        const pxDec = 9;
        const priceHuman = o.price < 1e12 ? o.price : o.price / 10 ** pxDec;
        if (priceHuman <= 0 || !Number.isFinite(priceHuman)) return false;
        return true;
      });
      setMarketOrders(validOrders);
    } catch {
      setMarketPositions([]);
      setMarketOrders([]);
    } finally {
      setPositionsOrdersLoading(false);
    }
  }, [open, account?.address, market, subaccountAddr]);

  useEffect(() => {
    if (!open || !account?.address || !market) return;
    fetchPositionsAndOrders();
  }, [open, account?.address, market?.marketAddr, fetchPositionsAndOrders]);

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
      // Debug: log raw addresses before payload build (to see if decimal form comes from API)
      console.log('[Decibel Open] raw inputs:', {
        subaccountAddr: typeof subaccountAddr === 'string' && subaccountAddr.length > 30
          ? `${subaccountAddr.slice(0, 24)}... (len=${subaccountAddr.length}, startsWith0x=${subaccountAddr.startsWith('0x')})`
          : subaccountAddr,
        marketAddr: typeof market.marketAddr === 'string' && market.marketAddr.length > 30
          ? `${market.marketAddr.slice(0, 24)}... (len=${market.marketAddr.length}, startsWith0x=${market.marketAddr.startsWith('0x')})`
          : market.marketAddr,
      });
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
      // Debug: log each argument before sending (identify which one causes u64 "out of range")
      const args = payload.functionArguments;
      const argNames = [
        'subaccountAddr',
        'marketAddr',
        'chainPrice',
        'chainSize',
        'isBuy',
        'timeInForce',
        'is_reduce_only',
        'client_order_id',
        'stop_price',
        'tp_trigger_price',
        'tp_limit_price',
        'sl_trigger_price',
        'sl_limit_price',
        'builderAddr',
        'builderFeeBps',
      ];
      const errNum = '12915772216665040055001747197620699795071116263423152195544898556698503341355';
      args.forEach((v, i) => {
        const name = argNames[i] ?? `arg${i}`;
        const type = typeof v;
        let detail: string;
        if (typeof v === 'string') {
          const asDecimal = v.startsWith('0x') ? BigInt(v).toString() : v;
          detail = v.length > 40 ? `"${v.slice(0, 18)}...${v.slice(-10)}" (len=${v.length})` : `"${v}"`;
          if (asDecimal === errNum || (v.length > 50 && asDecimal.length > 50)) {
            console.warn(`[Decibel Open] arg[${i}] ${name} decimal form: ${asDecimal.slice(0, 30)}... (matches error? ${asDecimal === errNum})`);
          }
        } else {
          detail = String(v);
        }
        console.log(`[Decibel Open] arg[${i}] ${name} (${type}): ${detail}`);
      });
      console.log('[Decibel Open] place_order payload.functionArguments summary:', {
        function: payload.function,
        argCount: args.length,
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
      // Refresh positions/orders after 1s so the API has time to reflect the new state
      setTimeout(() => {
        fetchOverview();
        fetchPositionsAndOrders();
      }, 1000);
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
    fetchPositionsAndOrders,
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

  const handleClosePosition = useCallback(async () => {
    const pos = closeDialogPosition;
    if (
      !pos ||
      !market ||
      !marketConfig ||
      !signAndSubmitTransaction ||
      !account?.address
    ) {
      setCloseDialogPosition(null);
      return;
    }
    const isLimit = closeMode === 'limit';
    const limitPriceNum = isLimit ? parseFloat(closeLimitPrice) : NaN;
    if (isLimit && (Number.isNaN(limitPriceNum) || limitPriceNum <= 0)) {
      toast({ title: 'Error', description: 'Enter a valid limit price.', variant: 'destructive' });
      return;
    }
    if (!isLimit && (markPx == null || markPx <= 0)) {
      setCloseDialogPosition(null);
      return;
    }
    setClosingPosition(true);
    try {
      const payload = isLimit
        ? buildCloseAtLimitPayload({
            subaccountAddr: pos.user,
            marketAddr: pos.market,
            size: Math.abs(pos.size),
            isLong: pos.size > 0,
            limitPrice: limitPriceNum,
            marketConfig,
            isTestnet: decibelNetwork === 'testnet',
            builderAddr: builderConfig?.builderAddress ?? undefined,
            builderFeeBps: builderConfig?.builderFeeBps ?? undefined,
          })
        : buildCloseAtMarketPayload({
            subaccountAddr: pos.user,
            marketAddr: pos.market,
            size: Math.abs(pos.size),
            isLong: pos.size > 0,
            markPx: markPx!,
            marketConfig,
            slippageBps: 50,
            isTestnet: decibelNetwork === 'testnet',
            builderAddr: builderConfig?.builderAddress ?? undefined,
            builderFeeBps: builderConfig?.builderFeeBps ?? undefined,
          });
      const result = await signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.typeArguments,
          functionArguments: payload.functionArguments as (string | number | boolean | null)[],
        },
        options: { maxGasAmount: 20000 },
      });
      const txHash = typeof result?.hash === 'string' ? result.hash : (result as { hash?: string })?.hash ?? '';
      toast({
        title: isLimit ? 'Limit close order placed' : 'Position closed',
        description: txHash ? `Tx ${txHash.slice(0, 6)}...${txHash.slice(-4)}` : 'Submitted',
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
      setCloseDialogPosition(null);
      fetchOverview();
      setTimeout(() => {
        fetchOverview();
        fetchPositionsAndOrders();
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Close failed', description: msg, variant: 'destructive' });
    } finally {
      setClosingPosition(false);
    }
  }, [
    closeDialogPosition,
    closeMode,
    closeLimitPrice,
    market,
    marketConfig,
    markPx,
    signAndSubmitTransaction,
    account?.address,
    decibelNetwork,
    builderConfig,
    toast,
    fetchOverview,
    fetchPositionsAndOrders,
  ]);

  const handleCancelOrder = useCallback(
    async (orderId: string) => {
      if (!orderId || !signAndSubmitTransaction || !account?.address || !subaccountAddr || !market) return;
      setCancelingOrderId(orderId);
      try {
        const payload = buildCancelOrderPayload({
          subaccountAddr,
          marketAddr: market.marketAddr,
          orderId,
          isTestnet: decibelNetwork === 'testnet',
        });
        const result = await signAndSubmitTransaction({
          data: {
            function: payload.function as `${string}::${string}::${string}`,
            typeArguments: payload.typeArguments,
            functionArguments: payload.functionArguments as (string | number | bigint)[],
          },
          options: { maxGasAmount: 20000 },
        });
        const txHash = typeof result?.hash === 'string' ? result.hash : (result as { hash?: string })?.hash ?? '';
        toast({
          title: 'Order cancelled',
          description: txHash ? `Tx ${txHash.slice(0, 6)}...${txHash.slice(-4)}` : 'Submitted',
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
        setTimeout(() => {
          fetchPositionsAndOrders();
        }, 1000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      } finally {
        setCancelingOrderId(null);
      }
    },
    [
      signAndSubmitTransaction,
      account?.address,
      subaccountAddr,
      market,
      decibelNetwork,
      toast,
      fetchPositionsAndOrders,
    ]
  );

  const truncateAddress = (addr: string) => {
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <>
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
              <DialogTitle className="truncate flex items-center gap-1.5 flex-wrap">
                {market ? `Trade — ${market.marketName}` : 'Trade'}
                {market && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground font-normal text-sm">
                    on
                    <Image
                      src="/protocol_ico/decibel.png"
                      alt=""
                      width={18}
                      height={18}
                      className="rounded-full object-contain shrink-0"
                      unoptimized
                    />
                    Decibel
                  </span>
                )}
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
              {/* Open positions and orders for this market (compact) */}
              {(marketPositions.length > 0 || marketOrders.length > 0 || positionsOrdersLoading) && (
                <div className="pt-2 mt-2 border-t border-border space-y-1.5">
                  {positionsOrdersLoading ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : (
                    <>
                      {marketPositions.map((pos) => {
                        const isLong = pos.size > 0;
                        const baseName = market?.marketName?.split('/')[0]?.trim() || '—';
                        return (
                          <div
                            key={`${pos.market}-${pos.user}-${pos.entry_price}`}
                            className="flex items-center justify-between gap-2 flex-wrap"
                          >
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Position:</span>{' '}
                              <span className={isLong ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {isLong ? 'Long' : 'Short'}
                              </span>{' '}
                              {formatSizeShort(Math.abs(pos.size))} {baseName}
                              {' · '}
                              Entry {formatNumber(pos.entry_price, 2)}
                            </p>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs shrink-0"
                              onClick={() => {
                                setCloseDialogPosition(pos);
                                setCloseMode('market');
                                setCloseLimitPrice(markPx != null ? formatNumber(markPx, 4) : '');
                              }}
                            >
                              Close
                            </Button>
                          </div>
                        );
                      })}
                      {marketOrders.map((o) => {
                        const reduceOnly = o.reduce_only ?? o.is_reduce_only === true;
                        const pxDecimals = marketConfig?.px_decimals ?? 9;
                        const priceHuman =
                          o.price > 0 && o.price < 1e12
                            ? o.price
                            : o.price / 10 ** pxDecimals;
                        const rawSize = o.remaining_size ?? o.orig_size;
                        const szDecimals = marketConfig?.sz_decimals ?? 9;
                        const sizeHuman =
                          rawSize != null
                            ? rawSize > 0 && rawSize < 1e10
                              ? Math.abs(rawSize)
                              : Math.abs(rawSize) / 10 ** szDecimals
                            : 0;
                        const baseName = market?.marketName?.split('/')[0]?.trim() || '—';
                        const label = reduceOnly
                          ? `Limit close @ ${formatNumber(priceHuman, 2)}`
                          : sizeHuman > 0
                            ? `Limit ${formatSizeShort(sizeHuman)} ${baseName} @ ${formatNumber(priceHuman, 2)}`
                            : `Limit @ ${formatNumber(priceHuman, 2)}`;
                        const isCanceling = o.order_id && cancelingOrderId === o.order_id;
                        return (
                          <div
                            key={o.order_id ?? `${o.price}-${o.remaining_size ?? o.orig_size}`}
                            className="flex items-center justify-between gap-2 flex-wrap"
                          >
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Order:</span> {label}
                            </p>
                            {o.order_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-destructive shrink-0"
                                disabled={!!cancelingOrderId}
                                onClick={() => handleCancelOrder(o.order_id!)}
                              >
                                {isCanceling ? 'Canceling…' : 'Cancel'}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Close position confirmation dialog */}
    <Dialog
      open={!!closeDialogPosition}
      onOpenChange={(open) => {
        if (!open) {
          setCloseDialogPosition(null);
          setCloseMode('market');
          setCloseLimitPrice('');
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close position</DialogTitle>
          {closeDialogPosition && market && (
            <>
              <p className="text-sm font-medium text-foreground mt-1">Close at:</p>
              <div className="flex gap-1 p-0.5 rounded-lg border bg-muted/40">
                <button
                  type="button"
                  onClick={() => setCloseMode('market')}
                  className={cn(
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    closeMode === 'market'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Market
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCloseMode('limit');
                    if (markPx != null) setCloseLimitPrice(formatNumber(markPx, 4));
                  }}
                  className={cn(
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    closeMode === 'limit'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Limit
                </button>
              </div>
              {closeMode === 'limit' && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="close-limit-price">Limit price</Label>
                  <Input
                    id="close-limit-price"
                    type="number"
                    step="any"
                    min="0"
                    placeholder={markPx != null ? String(markPx) : '0'}
                    value={closeLimitPrice}
                    onChange={(e) => setCloseLimitPrice(e.target.value)}
                    className="font-mono"
                  />
                  {markPx != null && (
                    <p className="text-xs text-muted-foreground">Mark: {formatNumber(markPx, 4)}</p>
                  )}
                </div>
              )}
            </>
          )}
          {closeDialogPosition && market && (
            <DialogDescription>
              Close {formatSizeShort(Math.abs(closeDialogPosition.size))}{' '}
              {market.marketName?.split('/')[0] ?? 'position'}
              {closeMode === 'market' ? (
                <>
                  {' '}
                  at market price
                  {markPx != null && ` (~${formatNumber(markPx, 2)})`}
                  ? This will execute immediately (IOC).
                </>
              ) : (
                ' at your limit price? Order will stay in the book until filled or you cancel it.'
              )}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setCloseDialogPosition(null);
              setCloseMode('market');
              setCloseLimitPrice('');
            }}
            disabled={closingPosition}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleClosePosition}
            disabled={
              closingPosition ||
              !closeDialogPosition ||
              !marketConfig ||
              (closeMode === 'market' && (markPx == null || markPx <= 0)) ||
              (closeMode === 'limit' &&
                (!closeLimitPrice.trim() ||
                  Number.isNaN(parseFloat(closeLimitPrice)) ||
                  parseFloat(closeLimitPrice) <= 0))
            }
          >
            {closingPosition
              ? closeMode === 'limit'
                ? 'Placing…'
                : 'Closing…'
              : closeMode === 'limit'
                ? 'Place limit close'
                : 'Close at market'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
