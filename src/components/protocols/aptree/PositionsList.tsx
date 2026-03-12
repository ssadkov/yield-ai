"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { ProtocolCard } from "@/shared/ProtocolCard";
import { PositionBadge } from "@/shared/ProtocolCard/types";
import { formatNumber } from "@/lib/utils/numberFormat";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
}

interface AptreePosition {
  poolId: number;
  assetName: string;
  balance: string;
  value: string;
  displayPrice?: number;
  displayAmount?: string;
  type: "deposit";
  assetInfo?: {
    symbol?: string;
    logoUrl?: string;
    decimals?: number;
    name?: string;
  };
}

export function PositionsList({
  address,
  onPositionsValueChange,
  refreshKey,
  onPositionsCheckComplete,
  showManageButton = true,
}: PositionsListProps) {
  const [positions, setPositions] = useState<AptreePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const protocol = getProtocolByName("APTree");
  const onValueRef = useRef(onPositionsValueChange);
  const onCompleteRef = useRef(onPositionsCheckComplete);
  onValueRef.current = onPositionsValueChange;
  onCompleteRef.current = onPositionsCheckComplete;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) setLoading(true);
      if (!address) {
        setPositions([]);
        setTotalValue(0);
        onValueRef.current?.(0);
        onCompleteRef.current?.();
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/protocols/aptree/userPositions?address=${encodeURIComponent(address)}`
        );
        const data = await res.json().catch(() => null);
        const positions = Array.isArray(data?.data) ? data.data : [];
        const total = positions.reduce((sum: number, p: { value?: string | number }) => {
          const v = typeof p?.value === 'number' ? p.value : Number(p?.value || 0);
          return sum + (Number.isFinite(v) ? v : 0);
        }, 0);
        if (!cancelled) {
          setPositions(positions);
          setTotalValue(total);
          onValueRef.current?.(total);
        }
      } catch {
        if (!cancelled) {
          setPositions([]);
          setTotalValue(0);
          onValueRef.current?.(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          onCompleteRef.current?.();
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  const protocolPositions = useMemo(
    () =>
      positions
        .map((position, idx) => {
          const decimals = position.assetInfo?.decimals ?? 6;
          const amountFromBalance = Number(position.balance || 0) / Math.pow(10, decimals);
          const value = Number(position.value || 0);
          const amount = Number(position.displayAmount || amountFromBalance);
          const price = Number.isFinite(Number(position.displayPrice))
            ? Number(position.displayPrice)
            : amount > 0
              ? value / amount
              : undefined;
          const symbol = position.assetInfo?.symbol || position.assetName || "USDT";
          return {
            id: `aptree-${position.poolId}-${idx}`,
            label: symbol,
            value: Number.isFinite(value) ? value : 0,
            logoUrl:
              position.assetInfo?.logoUrl ||
              "https://assets.panora.exchange/tokens/aptos/USDT.svg",
            badge: PositionBadge.Supply,
            subLabel: formatNumber(amount, 2),
            price,
          };
        })
        .sort((a, b) => b.value - a.value),
    [positions]
  );

  if (!protocol) {
    return null;
  }

  if (!loading && positions.length === 0) {
    return null;
  }

  return (
    <ProtocolCard
      protocol={protocol}
      totalValue={totalValue}
      positions={protocolPositions}
      isLoading={loading && positions.length === 0}
      showManageButton={showManageButton}
    />
  );
}
