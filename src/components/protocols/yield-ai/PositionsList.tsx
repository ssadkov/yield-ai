"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { ChevronDown, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/numberFormat";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { TokenList } from "@/components/portfolio/TokenList";
import { ManagePositionsButton } from "@/components/protocols/ManagePositionsButton";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { Token } from "@/lib/types/token";
import { APTOS_COIN_TYPE } from "@/lib/constants/yieldAiVault";
import type { TokenPrice } from "@/lib/types/panora";
import styles from "@/shared/ProtocolCard/ProtocolCard.module.css";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useMoarPositions,
  useMoarRewards,
  useMoarPools,
} from "@/lib/query/hooks/protocols/moar";
import { mapMoarPositionsToProtocolPositions } from "@/components/protocols/moar/mapMoarToProtocolPositions";
import { ProtocolCardPosition } from "@/shared/ProtocolCard/ProtocolCardPosition/ProtocolCardPosition";

/** Inline Moar positions + rewards for a single safe (no nested card). */
function MoarInline({
  safeAddress,
  onValueChange,
  refreshKey,
}: {
  safeAddress: string;
  onValueChange: (value: number) => void;
  refreshKey?: number;
}) {
  const { data: positions = [] } = useMoarPositions(safeAddress, {
    refetchOnMount: refreshKey != null ? "always" : undefined,
  });
  const { data: rewardsResponse } = useMoarRewards(safeAddress);
  const { data: poolsResponse } = useMoarPools();

  const rewardsData = rewardsResponse?.data ?? [];
  const rewardsTotalUsd = rewardsResponse?.totalUsd ?? 0;
  const positionsValue = positions.reduce(
    (sum, p) => sum + parseFloat(p.value || "0"),
    0
  );
  const totalValue = positionsValue + rewardsTotalUsd;

  const aprByPoolId = (() => {
    if (!poolsResponse?.data) return {} as Record<number, number>;
    const map: Record<number, number> = {};
    (poolsResponse.data as { poolId?: number; totalAPY?: number }[]).forEach(
      (pool) => {
        if (pool.poolId !== undefined) {
          map[pool.poolId] = pool.totalAPY ?? 0;
        }
      }
    );
    return map;
  })();

  const protocolPositions = mapMoarPositionsToProtocolPositions(
    positions,
    aprByPoolId
  );

  const totalRewardsUsd =
    rewardsTotalUsd > 0
      ? rewardsTotalUsd < 1
        ? "<$1"
        : formatCurrency(rewardsTotalUsd, 2)
      : undefined;

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  useEffect(() => {
    onValueChangeRef.current(totalValue);
  }, [totalValue]);

  if (positions.length === 0 && rewardsTotalUsd === 0) return null;

  return (
    <div className="space-y-1 mt-2">
      {protocolPositions.map((pos, i) => (
        <ProtocolCardPosition key={pos.id ?? i} position={pos} />
      ))}
      {totalRewardsUsd && (
        <div className={styles.totalRewardsRow}>
          <span className={styles.totalRewardsLabel}>💰 Total rewards:</span>
          <span className={styles.totalRewardsValue}>{totalRewardsUsd}</span>
        </div>
      )}
    </div>
  );
}

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
}

export function PositionsList({
  address,
  onPositionsValueChange,
  refreshKey,
  onPositionsCheckComplete,
  showManageButton = true,
}: PositionsListProps) {
  const walletAddress = address ?? null;
  const { toast } = useToast();
  const { isExpanded, toggleSection } = useCollapsible();
  const sectionKey = "yield-ai";
  const expanded = isExpanded(sectionKey);

  const [safeAddresses, setSafeAddresses] = useState<string[]>([]);
  const [tokensBySafe, setTokensBySafe] = useState<Record<string, Token[]>>({});
  const [moarValueBySafe, setMoarValueBySafe] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const onValueRef = useRef(onPositionsValueChange);
  const onCompleteRef = useRef(onPositionsCheckComplete);
  onValueRef.current = onPositionsValueChange;
  onCompleteRef.current = onPositionsCheckComplete;

  // Fetch safe addresses for owner
  useEffect(() => {
    if (!walletAddress) {
      setSafeAddresses([]);
      setTokensBySafe({});
      setMoarValueBySafe({});
      onCompleteRef.current?.();
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/protocols/yield-ai/safes?owner=${encodeURIComponent(walletAddress)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const list = json?.data?.safeAddresses ?? [];
        setSafeAddresses(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setSafeAddresses([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  // For each safe: fetch safe-contents, build Token[] with prices
  useEffect(() => {
    if (safeAddresses.length === 0) {
      setTokensBySafe({});
      return;
    }
    const pricesService = PanoraPricesService.getInstance();
    safeAddresses.forEach((safeAddress) => {
      let cancelled = false;
      fetch(`/api/protocols/yield-ai/safe-contents?safeAddress=${encodeURIComponent(safeAddress)}`)
        .then((res) => res.json())
        .then(async (json) => {
          if (cancelled) return;
          const data = json?.data;
          const faTokens = data?.tokens ?? [];
          const aptBalance = data?.aptBalance ?? "0";

          const tokenAddresses = [
            ...faTokens.map((t: { asset_type: string }) => t.asset_type),
            APTOS_COIN_TYPE,
          ].filter(Boolean);
          let prices: TokenPrice[] = [];
          try {
            const pr = await pricesService.getPrices(1, tokenAddresses);
            prices = Array.isArray(pr) ? pr : (pr?.data ?? []);
          } catch {
            // no prices
          }

          const tokens: Token[] = [];
          for (const t of faTokens) {
            const price = prices.find(
              (p) =>
                p.faAddress === t.asset_type ||
                p.tokenAddress === t.asset_type
            );
            const decimals = price?.decimals ?? 8;
            const amount = parseFloat(t.amount) / Math.pow(10, decimals);
            const usd = price ? amount * parseFloat(price.usdPrice) : 0;
            tokens.push({
              address: t.asset_type,
              name: price?.name ?? t.asset_type.split("::").pop() ?? "",
              symbol: price?.symbol ?? "?",
              decimals,
              amount: t.amount,
              price: price?.usdPrice ?? null,
              value: price ? String(usd) : null,
            });
          }
          if (BigInt(aptBalance) > 0) {
            const aptPrice = prices.find(
              (p) => p.tokenAddress === APTOS_COIN_TYPE || p.faAddress === APTOS_COIN_TYPE
            );
            const decimals = aptPrice?.decimals ?? 8;
            const amount = Number(aptBalance) / Math.pow(10, decimals);
            const usd = aptPrice ? amount * parseFloat(aptPrice.usdPrice) : 0;
            tokens.push({
              address: APTOS_COIN_TYPE,
              name: "Aptos Coin",
              symbol: "APT",
              decimals,
              amount: aptBalance,
              price: aptPrice?.usdPrice ?? null,
              value: aptPrice ? String(usd) : null,
            });
          }
          setTokensBySafe((prev) => ({ ...prev, [safeAddress]: tokens }));
        })
        .catch(() => {
          if (!cancelled) setTokensBySafe((prev) => ({ ...prev, [safeAddress]: [] }));
        });
      return () => {
        cancelled = true;
      };
    });
  }, [safeAddresses]);

  const tokensValue = Object.values(tokensBySafe).reduce(
    (sum, tokens) =>
      sum +
      tokens.reduce((s, t) => s + (t.value ? parseFloat(t.value) : 0), 0),
    0
  );
  const totalMoarValue = Object.values(moarValueBySafe).reduce((a, b) => a + b, 0);
  const totalValue = tokensValue + totalMoarValue;

  useEffect(() => {
    onValueRef.current?.(totalValue);
  }, [totalValue]);

  useEffect(() => {
    if (!loading && walletAddress !== null) {
      onCompleteRef.current?.();
    }
  }, [loading, walletAddress]);

  const protocol = getProtocolByName("AI agent");
  if (!protocol) return null;

  // Do not show card when user has no safe
  if (safeAddresses.length === 0) return null;

  return (
    <div className={cn(styles.card)}>
      <div
        className={styles.header}
        onClick={() => toggleSection(sectionKey)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && toggleSection(sectionKey)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {protocol.logoUrl ? (
            <Image
              src={protocol.logoUrl}
              alt=""
              width={20}
              height={20}
              className={styles.logo}
              unoptimized
            />
          ) : null}
          <span className={styles.title}>{protocol.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>{formatCurrency(totalValue, 2)}</span>
          <ChevronDown
            className={cn(styles.chevron, !expanded && styles.chevronCollapsed)}
            size={20}
          />
        </div>
      </div>

      {expanded && (
        <div className={styles.content}>
          {safeAddresses.map((safeAddress) => (
            <div key={safeAddress} className="space-y-3 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">
                  Safe {safeAddress.slice(0, 6)}...{safeAddress.slice(-4)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard
                          .writeText(safeAddress)
                          .then(() =>
                            toast({
                              title: "Copied",
                              description: "Safe address copied to clipboard",
                            })
                          )
                          .catch(() =>
                            toast({
                              title: "Copy failed",
                              variant: "destructive",
                            })
                          );
                      }}
                      aria-label="Copy safe address"
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy safe address</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {tokensBySafe[safeAddress]?.length ? (
                <TokenList
                  tokens={tokensBySafe[safeAddress]}
                  disableDrag
                  getRightBadge={(t) => (t.symbol === "USDC" ? "AGENT WALLET" : undefined)}
                />
              ) : tokensBySafe[safeAddress] === undefined ? (
                <p className="text-sm text-muted-foreground">Loading tokens…</p>
              ) : null}
              <MoarInline
                safeAddress={safeAddress}
                onValueChange={(value) =>
                  setMoarValueBySafe((prev) => ({ ...prev, [safeAddress]: value }))
                }
                refreshKey={refreshKey}
              />
            </div>
          ))}
        </div>
      )}
      {expanded && showManageButton && protocol && (
        <div className="px-3 pb-2">
          <ManagePositionsButton protocol={protocol} />
        </div>
      )}
    </div>
  );
}
