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
import { Info, Target } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { formatNumber, formatCurrency } from '@/lib/utils/numberFormat';
import { normalizeAddress } from '@/lib/utils/addressNormalization';
import { cn } from '@/lib/utils';
import { DecibelOpenPositionModal, type DecibelOpenPositionMarket } from '@/components/decibel/decibel-open-position-modal';
import {
  buildCloseAtMarketPayload,
  buildCloseAtLimitPayload,
  buildCancelOrderPayload,
  type DecibelMarketConfig,
} from '@/lib/protocols/decibel/closePosition';
import { buildApproveBuilderFeePayload } from '@/lib/protocols/decibel/approveBuilderFee';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  /** Total amount deposited (gross). */
  total_deposited?: number;
  /** Total amount withdrawn. Used for PnL when all_time_earned is not present. */
  total_withdrawn?: number;
  /** All-time PnL in USDC (realized + unrealized). Prefer for "Your PnL" when API provides it. */
  all_time_earned?: number;
  /** APR in % (e.g. 2.98 = 2.98%), from API; display as-is, do not multiply by 100 */
  apr?: number;
}

/** Open order from Decibel open_orders API (supports snake_case and common variants) */
export interface DecibelOpenOrder {
  market?: string;
  market_address?: string;
  price: number;
  size?: number;
  /** API returns human size (e.g. 0.00015) */
  orig_size?: number;
  remaining_size?: number;
  size_delta?: number;
  reduce_only?: boolean;
  is_reduce_only?: boolean;
  order_id?: string;
}

/** Normalize API response to array of orders (data may be array or { items, total_count }) */
function normalizeOpenOrdersResponse(data: unknown): DecibelOpenOrder[] {
  if (Array.isArray(data)) return data as DecibelOpenOrder[];
  if (data && typeof data === 'object' && 'items' in data && Array.isArray((data as { items: unknown }).items)) {
    return (data as { items: DecibelOpenOrder[] }).items;
  }
  return [];
}

/** Find reduce-only order for this position (same market) */
function getOrderForPosition(
  orders: DecibelOpenOrder[],
  position: DecibelPosition
): DecibelOpenOrder | undefined {
  const posMarket = normalizeAddress(position.market);
  return orders.find((o) => {
    const orderMarket = normalizeAddress((o.market ?? o.market_address ?? ''));
    const reduceOnly = o.reduce_only ?? o.is_reduce_only === true;
    return orderMarket === posMarket && reduceOnly;
  });
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

/** Decibel returns funding in bps; convert to percent for UI. */
function formatFundingRatePercent(fundingRateBps: number): string {
  const percent = fundingRateBps / 100;
  const sign = percent > 0 ? '+' : percent < 0 ? '-' : '';
  return `${sign}${formatNumber(Math.abs(percent), 6)}%`;
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
  const [closeMode, setCloseMode] = useState<'market' | 'limit'>('market');
  const [closeLimitPrice, setCloseLimitPrice] = useState('');
  const [dialogMarkPx, setDialogMarkPx] = useState<number | null>(null);
  const [availableToTrade, setAvailableToTrade] = useState<number | null>(null);
  const [totalEquity, setTotalEquity] = useState<number | null>(null);
  const [preDepositSumUsdc, setPreDepositSumUsdc] = useState<number | null>(null);
  const [preDepositLoading, setPreDepositLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vaultsLoading, setVaultsLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [pricesMap, setPricesMap] = useState<Record<string, number>>({});
  const [fundingRatesMap, setFundingRatesMap] = useState<
    Record<string, { fundingRateBps: number; isFundingPositive: boolean }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [builderConfig, setBuilderConfig] = useState<{ builderAddress: string; builderFeeBps: number } | null>(null);
  const [totalAmps, setTotalAmps] = useState<number | null>(null);
  const [ampsLoading, setAmpsLoading] = useState(false);
  const [predepositPoints, setPredepositPoints] = useState<number | null>(null);
  const [predepositPointsLoading, setPredepositPointsLoading] = useState(false);
  const [openOrders, setOpenOrders] = useState<DecibelOpenOrder[]>([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeMarket, setTradeMarket] = useState<DecibelOpenPositionMarket | null>(null);

  useEffect(() => {
    if (!account?.address) {
      setBuilderConfig(null);
      return;
    }
    let cancelled = false;
    fetch('/api/protocols/decibel/builder-config')
      .then((r) => r.json())
      .then((data: { success?: boolean; builderAddress?: string; builderFeeBps?: number }) => {
        if (cancelled) return;
        if (data?.success && data.builderAddress && typeof data.builderFeeBps === 'number') {
          setBuilderConfig({ builderAddress: data.builderAddress, builderFeeBps: data.builderFeeBps });
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
  }, [account?.address]);

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
        const fundingMap: Record<string, { fundingRateBps: number; isFundingPositive: boolean }> = {};
        for (const item of data.data as {
          market?: string;
          mark_px?: number;
          mid_px?: number;
          funding_rate_bps?: number;
          is_funding_positive?: boolean;
        }[]) {
          const addr = item.market;
          if (addr != null) {
            const key = normalizeAddress(String(addr));
            const mark = item.mark_px ?? item.mid_px;
            if (typeof mark === 'number') map[key] = mark;
            if (typeof item.funding_rate_bps === 'number') {
              fundingMap[key] = {
                fundingRateBps: item.funding_rate_bps,
                isFundingPositive: item.is_funding_positive === true,
              };
            }
          }
        }
        setPricesMap(map);
        setFundingRatesMap(fundingMap);
      } else {
        setPricesMap({});
        setFundingRatesMap({});
      }
    } catch {
      setPricesMap({});
      setFundingRatesMap({});
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

  const fetchAmps = useCallback(async () => {
    if (!account?.address) {
      setTotalAmps(null);
      return;
    }
    setAmpsLoading(true);
    try {
      const res = await fetch(
        `/api/protocols/decibel/amps?owner=${encodeURIComponent(account.address.toString())}`
      );
      const data = await res.json();
      if (data.success && typeof data.data?.total_amps === 'number') {
        setTotalAmps(data.data.total_amps);
      } else {
        setTotalAmps(null);
      }
    } catch {
      setTotalAmps(null);
    } finally {
      setAmpsLoading(false);
    }
  }, [account?.address]);

  const fetchPredepositPoints = useCallback(async () => {
    if (!account?.address) {
      setPredepositPoints(null);
      return;
    }
    setPredepositPointsLoading(true);
    try {
      const res = await fetch(
        `/api/protocols/decibel/predepositPoints?address=${encodeURIComponent(account.address.toString())}`
      );
      const data = await res.json();
      if (data.success && typeof data.data?.points === 'number') {
        setPredepositPoints(data.data.points);
      } else {
        setPredepositPoints(null);
      }
    } catch {
      setPredepositPoints(null);
    } finally {
      setPredepositPointsLoading(false);
    }
  }, [account?.address]);

  const fetchOpenOrders = useCallback(async () => {
    if (!account?.address) {
      setOpenOrders([]);
      return;
    }
    // Decibel open_orders returns orders per subaccount, not per owner. Use subaccounts from positions.
    const subaccounts = positions.length > 0
      ? Array.from(new Set(positions.map((p) => p.user).filter(Boolean)))
      : [account.address.toString()];
    setOpenOrdersLoading(true);
    try {
      const allOrders: DecibelOpenOrder[] = [];
      for (const addr of subaccounts) {
        const res = await fetch(
          `/api/protocols/decibel/openOrders?address=${encodeURIComponent(addr)}`
        );
        const data = await res.json();
        if (data.success && data.data != null) {
          allOrders.push(...normalizeOpenOrdersResponse(data.data));
        }
      }
      setOpenOrders(allOrders);
    } catch {
      setOpenOrders([]);
    } finally {
      setOpenOrdersLoading(false);
    }
  }, [account?.address, positions]);

  useEffect(() => {
    fetchAmps();
  }, [fetchAmps]);

  useEffect(() => {
    fetchPredepositPoints();
  }, [fetchPredepositPoints]);

  useEffect(() => {
    fetchOpenOrders();
  }, [fetchOpenOrders]);

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
        fetchAmps();
        fetchPredepositPoints();
        fetchOpenOrders();
      }
    };
    window.addEventListener('refreshPositions', handler as EventListener);
    return () => window.removeEventListener('refreshPositions', handler as EventListener);
  }, [fetchVaults, fetchOverview, fetchPreDeposit, fetchPrices, fetchAmps, fetchPredepositPoints, fetchOpenOrders]);

  const positionKey = (pos: DecibelPosition) => `${pos.market}-${pos.user}-${pos.size}-${pos.entry_price}`;

  const handleCloseClick = (pos: DecibelPosition) => {
    setCloseConfirmPosition(pos);
    setCloseMode('market');
    setCloseLimitPrice('');
  };

  const handleViewChartClick = (pos: DecibelPosition) => {
    const marketKey = normalizeAddress(pos.market);
    const marketName = marketNames[marketKey] ?? pos.market;
    setTradeMarket({
      marketAddr: pos.market,
      marketName,
    });
    setTradeModalOpen(true);
  };

  // Fetch mark price when close dialog opens (for limit price hint)
  useEffect(() => {
    if (!closeConfirmPosition) {
      setDialogMarkPx(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/protocols/decibel/prices?market=${encodeURIComponent(closeConfirmPosition.market)}`
        );
        const data = await res.json();
        if (cancelled) return;
        const list = data.success && Array.isArray(data.data) ? data.data : [];
        const item =
          list.find(
            (p: { market?: string }) => normalizeAddress(p.market || '') === normalizeAddress(closeConfirmPosition.market)
          ) ?? list[0];
        const mark = item?.mark_px ?? item?.mid_px ?? closeConfirmPosition.entry_price;
        const markNum = typeof mark === 'number' ? mark : null;
        setDialogMarkPx(markNum);
        // Prefill limit price when mark loads and user already switched to Limit
        if (markNum != null) {
          setCloseLimitPrice((prev) => (prev === '' ? formatNumber(markNum, 4) : prev));
        }
      } catch {
        if (!cancelled) setDialogMarkPx(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [closeConfirmPosition]);

  const handleConfirmClose = useCallback(async () => {
    const pos = closeConfirmPosition;
    const walletAddress = account?.address;
    if (!pos || (!signTransaction && !signAndSubmitTransaction) || !walletAddress) {
      setCloseConfirmPosition(null);
      return;
    }
    const key = positionKey(pos);
    setClosingPositionKey(key);
    try {
      if (builderConfig) {
        const approvalRes = await fetch(
          `/api/protocols/decibel/approved-max-fee?subaccount=${encodeURIComponent(pos.user)}`
        );
        const approvalData = (await approvalRes.json()) as { success?: boolean; approvedMaxFeeBps?: number | null };
        if (approvalRes.ok && approvalData?.success && approvalData.approvedMaxFeeBps == null) {
          if (!account?.address) {
            toast({
              title: 'Wallet not connected',
              description: 'Please reconnect your Aptos wallet and try again.',
              variant: 'destructive',
            });
            return;
          }
          const approvePayload = buildApproveBuilderFeePayload({
            subaccountAddr: pos.user,
            builderAddr: builderConfig.builderAddress,
            maxFeeBps: builderConfig.builderFeeBps,
            isTestnet: decibelNetwork === 'testnet',
          });
          if (signAndSubmitTransaction) {
            await signAndSubmitTransaction({
              data: {
                function: approvePayload.function as `${string}::${string}::${string}`,
                typeArguments: approvePayload.typeArguments,
                functionArguments: approvePayload.functionArguments as (string | number)[],
              },
              options: { maxGasAmount: 20000 },
            });
          } else if (signTransaction) {
            const aptos = getDecibelAptosClient(decibelNetwork);
            const senderAddr = AccountAddress.fromString(walletAddress.toString());
            const transaction = await aptos.transaction.build.simple({
              sender: senderAddr,
              data: {
                function: approvePayload.function as `${string}::${string}::${string}`,
                typeArguments: approvePayload.typeArguments,
                functionArguments: approvePayload.functionArguments as (string | number)[],
              },
              options: { maxGasAmount: 20000 },
            });
            const signResult = await signTransaction({ transactionOrPayload: transaction });
            const { authenticator } = signResult;
            await aptos.transaction.submit.simple({
              transaction,
              senderAuthenticator: normalizeAuthenticator(authenticator),
            });
          } else {
            throw new Error('Wallet does not support signing transactions');
          }
          toast({ title: 'Trading via Yield AI enabled', description: 'Closing position…' });
        }
      }

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

      const isLimit = closeMode === 'limit';
      const limitPriceNum = isLimit ? parseFloat(closeLimitPrice) : NaN;
      if (isLimit && (Number.isNaN(limitPriceNum) || limitPriceNum <= 0)) {
        toast({ title: 'Error', description: 'Enter a valid limit price.', variant: 'destructive' });
        setClosingPositionKey(null);
        return;
      }

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
            markPx,
            marketConfig,
            slippageBps: 50,
            isTestnet: decibelNetwork === 'testnet',
            builderAddr: builderConfig?.builderAddress ?? undefined,
            builderFeeBps: builderConfig?.builderFeeBps ?? undefined,
          });

      if (!account?.address) {
        toast({
          title: 'Wallet not connected',
          description: 'Please reconnect your Aptos wallet and try again.',
          variant: 'destructive',
        });
        return;
      }

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
        const senderAddr = AccountAddress.fromString(walletAddress.toString());
        const transaction = await aptos.transaction.build.simple({
          sender: senderAddr,
          data: {
            function: payload.function as `${string}::${string}::${string}`,
            typeArguments: payload.typeArguments,
            functionArguments: payload.functionArguments as (string | number | boolean | Uint8Array | null)[],
          },
          options: { maxGasAmount: 20000 },
        });
        console.log('[Decibel] sender:', senderAddr.toString(), 'wallet:', walletAddress.toString());
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
        title: isLimit ? 'Limit close order placed' : 'Position closed',
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
      fetchOpenOrders();
    } catch (err: unknown) {
      const rawMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err);
      const isWalletNotConnected =
        (err instanceof Error && err.name === 'WalletNotConnectedError') ||
        (typeof rawMsg === 'string' && rawMsg.includes('WalletNotConnectedError'));
      const testnetHint =
        decibelNetwork === 'testnet'
          ? ' Switch your wallet to Aptos Mainnet and try again.'
          : '';
      const msg = isWalletNotConnected
        ? 'Wallet disconnected or locked. Please unlock or reconnect your Aptos wallet and try again.'
        : (rawMsg || 'Failed to close position') + testnetHint;
      console.error('[Decibel] Close position error:', err);
      toast({
        title: isWalletNotConnected ? 'Wallet not connected' : 'Error',
        description: msg,
        variant: 'destructive',
      });
      setCloseConfirmPosition(null);
    } finally {
      setClosingPositionKey(null);
    }
  }, [closeConfirmPosition, closeMode, closeLimitPrice, signTransaction, signAndSubmitTransaction, account?.address, marketsMap, decibelNetwork, fetchPositions, fetchOpenOrders, toast, builderConfig]);

  const handleCancelClose = useCallback(() => {
    setCloseConfirmPosition(null);
    setCloseMode('market');
    setCloseLimitPrice('');
    setDialogMarkPx(null);
  }, []);

  const handleCancelOrder = useCallback(
    async (orderId: string, subaccountAddr: string, marketAddr: string) => {
      if (!orderId || (!signTransaction && !signAndSubmitTransaction) || !account?.address) return;
      setCancelingOrderId(orderId);
      try {
        const payload = buildCancelOrderPayload({
          subaccountAddr,
          marketAddr,
          orderId,
          isTestnet: decibelNetwork === 'testnet',
        });
        if (!account?.address) {
          toast({ title: 'Wallet not connected', description: 'Please reconnect and try again.', variant: 'destructive' });
          return;
        }
        let txHash: string;
        if (signAndSubmitTransaction) {
          const result = await signAndSubmitTransaction({
            data: {
              function: payload.function as `${string}::${string}::${string}`,
              typeArguments: payload.typeArguments,
              functionArguments: payload.functionArguments as (string | number | bigint)[],
            },
            options: { maxGasAmount: 20000 },
          });
          txHash = typeof result?.hash === 'string' ? result.hash : (result as { hash?: string })?.hash ?? '';
        } else if (signTransaction) {
          const aptos = getDecibelAptosClient(decibelNetwork);
          const senderAddr = AccountAddress.fromString(account.address.toString());
          const transaction = await aptos.transaction.build.simple({
            sender: senderAddr,
            data: {
              function: payload.function as `${string}::${string}::${string}`,
              typeArguments: payload.typeArguments,
              functionArguments: payload.functionArguments as (string | number | bigint)[],
            },
            options: { maxGasAmount: 20000 },
          });
          const signResult = await signTransaction({ transactionOrPayload: transaction });
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
          title: 'Order cancelled',
          description: txHash ? `Tx ${txHash.slice(0, 6)}...${txHash.slice(-4)}` : 'Transaction submitted',
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
        fetchOpenOrders();
        fetchPositions();
        window.dispatchEvent(new CustomEvent('refreshPositions', { detail: { protocol: 'decibel' } }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      } finally {
        setCancelingOrderId(null);
      }
    },
    [decibelNetwork, signTransaction, signAndSubmitTransaction, account?.address, toast, fetchOpenOrders, fetchPositions]
  );

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
              mainnet
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
                    <p>Decibel assets (positions, available to trade, vaults) are included in Total Assets.</p>
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
      {/* AMPs: trading + predeposit points, breakdown in tooltip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">AMPs</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex text-muted-foreground cursor-help">
                  <Info className="h-4 w-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px]">
                <p className="font-medium mb-1.5">Points breakdown</p>
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  <li>• Trading (AMPs): {ampsLoading ? '…' : formatNumber(totalAmps ?? 0, 2)}</li>
                  <li>• Predeposit points: {predepositPointsLoading ? '…' : formatNumber(predepositPoints ?? 0, 2)}</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-1.5">Trading data is updated once per day.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className={cn("font-medium", totalAmps == null && predepositPoints == null && !ampsLoading && !predepositPointsLoading && "text-muted-foreground")}>
          {ampsLoading || predepositPointsLoading ? '…' : formatNumber((totalAmps ?? 0) + (predepositPoints ?? 0), 2)}
        </span>
      </div>
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
              mainnet
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
                    <p>Decibel assets (positions, available to trade, vaults) are included in Total Assets.</p>
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
              const fundingRateInfo = fundingRatesMap[marketKey];
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
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
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
                      {(() => {
                        const order = getOrderForPosition(openOrders, pos);
                        if (!order) return null;
                        const marketConfig = marketsMap[marketKey] ?? Object.values(marketsMap).find((m) => normalizeAddress(m.market_addr || '') === marketKey);
                        const pxDecimals = marketConfig?.px_decimals ?? 9;
                        const szDecimals = marketConfig?.sz_decimals ?? 9;
                        // API may return human price (e.g. 70000) or chain units; use as-is if in human range
                        const orderPriceHuman =
                          order.price > 0 && order.price < 1e12
                            ? order.price
                            : order.price / 10 ** pxDecimals;
                        const rawSize = order.remaining_size ?? order.orig_size ?? order.size;
                        const orderSizeHuman =
                          rawSize != null
                            ? rawSize > 0 && rawSize < 1e10
                              ? Math.abs(rawSize)
                              : Math.abs(rawSize) / 10 ** szDecimals
                            : 0;
                        const sizeStr = orderSizeHuman > 0 ? `${formatSize(orderSizeHuman)} @ ` : '';
                        const orderLabel = `Limit close order ${sizeStr || '@ '}${formatNumber(orderPriceHuman, 4)}`;
                        const isCanceling = order.order_id && cancelingOrderId === order.order_id;
                        return (
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1.5 rounded-md border-l-2 border-primary/40 bg-muted/50 pl-2 py-1 pr-2 w-fit">
                                    <Target className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">{orderLabel}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[240px]">
                                  <p>
                                    Limit close order is active. It will fill when price reaches{' '}
                                    {formatNumber(orderPriceHuman, 4)} or you cancel it.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {order.order_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                disabled={!!cancelingOrderId}
                                onClick={() => handleCancelOrder(order.order_id!, pos.user, pos.market)}
                              >
                                {isCanceling ? 'Canceling…' : 'Cancel order'}
                              </Button>
                            )}
                          </div>
                        );
                      })()}
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
                      <div className="mt-2 flex items-center gap-2 self-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewChartClick(pos)}
                          disabled={!!closingPositionKey}
                        >
                          View chart
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCloseClick(pos)}
                          disabled={!!closingPositionKey}
                        >
                          {closingPositionKey === positionKey(pos) ? 'Closing…' : 'Close'}
                        </Button>
                      </div>
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
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Funding rate</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex text-muted-foreground cursor-help">
                                <Info className="h-3.5 w-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[260px]">
                              <p>
                                Current market funding rate for this perp. Decibel uses continuous
                                funding, so this is not an hourly rate.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <span className="ml-0">
                        {fundingRateInfo
                          ? formatFundingRatePercent(fundingRateInfo.fundingRateBps)
                          : '—'}
                      </span>
                      {fundingRateInfo && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {fundingRateInfo.isFundingPositive ? 'Longs pay shorts' : 'Shorts pay longs'}
                        </div>
                      )}
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
                {closeConfirmPosition && (
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
                          if (dialogMarkPx != null) setCloseLimitPrice(formatNumber(dialogMarkPx, 4));
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
                          placeholder={dialogMarkPx != null ? String(dialogMarkPx) : '0'}
                          value={closeLimitPrice}
                          onChange={(e) => setCloseLimitPrice(e.target.value)}
                          className="font-mono"
                        />
                        {dialogMarkPx != null && (
                          <p className="text-xs text-muted-foreground">Mark: {formatNumber(dialogMarkPx, 4)}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
                <DialogDescription>
                  {closeConfirmPosition && (
                    <>
                      Close {formatSize(Math.abs(closeConfirmPosition.size))}{' '}
                      {formatDecibelMarket(marketNames[normalizeAddress(closeConfirmPosition.market)] ?? closeConfirmPosition.market).displayPair}
                      {closeMode === 'market' ? (
                        <>
                          {' '}
                          at market price
                          {dialogMarkPx != null && (
                            <> (~{formatNumber(dialogMarkPx, 4)})</>
                          )}
                          ? This will execute immediately (IOC).
                        </>
                      ) : (
                        <> at your limit price? Order will stay in the book until filled or you cancel it.</>
                      )}
                      {decibelNetwork === 'testnet' && (
                        <span className="mt-2 block text-amber-600 dark:text-amber-400 font-medium">
                          Switch your wallet to Aptos Mainnet before closing.
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
                  disabled={
                    !!closingPositionKey ||
                    !closeConfirmPosition ||
                    (closeMode === 'limit' &&
                      (!closeLimitPrice.trim() ||
                        Number.isNaN(parseFloat(closeLimitPrice)) ||
                        parseFloat(closeLimitPrice) <= 0))
                  }
                >
                  {closingPositionKey
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
      )}

      {/* Vaults: show when we have vault deposits */}
      {(vaultsLoading || vaults.length > 0) && (
        <div className="space-y-2">
          <h4 className="text-base font-medium mb-2 text-muted-foreground flex items-center gap-2">
            Vaults
            <Badge variant="secondary" className="text-xs font-normal">
              mainnet
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
                    <p>Decibel assets (positions, available to trade, vaults) are included in Total Assets.</p>
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
                    <div className="shrink-0 flex items-center gap-2 text-right">
                      {v.apr != null && Number.isFinite(v.apr) && (
                        <Badge
                          variant="outline"
                          className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-2 py-0.5 h-5"
                        >
                          APR: {v.apr.toFixed(2)}%
                        </Badge>
                      )}
                      <div>
                        <div className="text-base font-medium">
                          {v.current_value_of_shares != null
                            ? formatCurrency(v.current_value_of_shares, 2)
                            : '—'}
                        </div>
                        {(typeof v.all_time_earned === 'number' && Number.isFinite(v.all_time_earned)) ||
                        (v.current_value_of_shares != null && v.total_deposited != null && Number.isFinite(v.current_value_of_shares) && Number.isFinite(v.total_deposited)) ? (
                          (() => {
                            const userPnl = typeof v.all_time_earned === 'number' && Number.isFinite(v.all_time_earned)
                              ? v.all_time_earned
                              : v.current_value_of_shares! - (v.total_deposited! - (v.total_withdrawn ?? 0));
                            return (
                              <div className={cn('text-sm', userPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                                PnL: {userPnl >= 0 ? '+' : ''}{formatCurrency(userPnl, 2)}
                              </div>
                            );
                          })()
                        ) : null}
                      </div>
                    </div>
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

      <DecibelOpenPositionModal
        open={tradeModalOpen}
        onOpenChange={(open) => {
          setTradeModalOpen(open);
          if (!open) setTradeMarket(null);
        }}
        market={tradeMarket}
      />
    </div>
  );
}
