"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import { ManagePositionsButton } from "../ManagePositionsButton";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { formatCurrency, formatNumber } from "@/lib/utils/numberFormat";
import { Badge } from "@/components/ui/badge";
import tokenList from "@/lib/data/tokenList.json";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
  walletTokens?: unknown[];
}

interface EchoPosition {
  positionId: string;
  aTokenAddress: string;
  aTokenSymbol: string;
  underlyingAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string | null;
  amountRaw: string;
  amount: number;
  priceUSD: number;
  valueUSD: number;
  type?: "supply" | "borrow";
}

function normalizeAddress(addr: string): string {
  if (!addr || !addr.startsWith("0x")) return addr;
  return "0x" + addr.slice(2).replace(/^0+/, "") || "0x0";
}

function getTokenLogoUrl(underlyingAddress: string, symbol: string): string | null {
  const normalized = normalizeAddress(underlyingAddress.startsWith("0x") ? underlyingAddress : `0x${underlyingAddress}`);
  const tokens = (tokenList as { data: { data: Array<{ tokenAddress?: string; faAddress?: string; symbol?: string; logoUrl?: string }> } }).data.data;
  const byAddress = tokens.find((t) => {
    const fa = t.faAddress ? normalizeAddress(t.faAddress) : null;
    const ta = t.tokenAddress ? normalizeAddress(t.tokenAddress) : null;
    return fa === normalized || ta === normalized;
  });
  if (byAddress?.logoUrl) return byAddress.logoUrl;
  const bySymbol = tokens.find((t) => t.symbol?.toLowerCase() === symbol?.toLowerCase());
  return bySymbol?.logoUrl ?? null;
}

function EchoPositionRow({
  position,
  logoUrl,
}: {
  position: EchoPosition;
  logoUrl: string | null;
}) {
  const isBorrow = position.type === "borrow";
  const valueStr =
    position.valueUSD > 0
      ? (isBorrow ? "-" : "") + formatCurrency(position.valueUSD, 2)
      : "$0.00";
  const priceStr = position.priceUSD > 0 ? formatNumber(position.priceUSD, 2) : "N/A";

  return (
    <div className="mb-2 flex justify-between items-center">
      <div className="flex items-center gap-2">
        {logoUrl ? (
          <div className="w-6 h-6 relative shrink-0">
            <Image
              src={logoUrl}
              alt={position.symbol}
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
            {position.symbol.slice(0, 2)}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{position.symbol}</span>
            <Badge
              variant="outline"
              className={
                isBorrow
                  ? "bg-red-500/10 text-red-600 border-red-500/20 text-xs font-normal px-2 py-0.5 h-5"
                  : "bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5"
              }
            >
              {isBorrow ? "Borrow" : "Supply"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">${priceStr}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={cn("text-sm font-medium", isBorrow && "text-red-600")}>{valueStr}</div>
        <div className="text-xs text-muted-foreground">{formatNumber(position.amount, 4)}</div>
      </div>
    </div>
  );
}

export function PositionsList({
  address,
  onPositionsValueChange,
  refreshKey,
  onPositionsCheckComplete,
  showManageButton = true,
}: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<EchoPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isExpanded, toggleSection } = useCollapsible();

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Echo Protocol");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        controller.abort();
      }
    }, 60000);

    async function loadPositions() {
      if (!walletAddress) {
        setPositions([]);
        onPositionsCheckComplete?.();
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/protocols/echo/userPositions?address=${encodeURIComponent(walletAddress)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) return;
        if (data.success && Array.isArray(data.data)) {
          setPositions(data.data);
        } else {
          setPositions([]);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") {
          setPositions([]);
        } else {
          setError("Failed to load positions");
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setLoading(false);
          onPositionsCheckComplete?.();
        }
      }
    }

    loadPositions();
    return () => {
      cancelled = true;
      // Do not abort here: parent re-renders (e.g. when other protocols finish) can cause
      // effect cleanup; aborting would cancel the fetch and positions would stay empty.
      clearTimeout(timeoutId);
    };
  // Do not add onPositionsCheckComplete to deps: parent re-renders when other protocols
  // finish and passes a new callback; that would re-run this effect and abort the fetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, refreshKey]);

  const supplyTotal = positions.filter((p) => p.type !== "borrow").reduce((sum, p) => sum + (p.valueUSD || 0), 0);
  const borrowTotal = positions.filter((p) => p.type === "borrow").reduce((sum, p) => sum + (p.valueUSD || 0), 0);
  const totalValue = supplyTotal - borrowTotal;
  const sortedPositions = [...positions].sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0));

  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  if (loading) {
    return null;
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>;
  }

  if (!walletAddress) {
    return <div className="text-sm text-muted-foreground">Connect wallet to view positions</div>;
  }

  if (positions.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection("echo")}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {protocol && (
              <div className="w-5 h-5 relative">
                <Image
                  src={protocol.logoUrl}
                  alt={protocol.name}
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
            )}
            <CardTitle className="text-lg">Echo Protocol</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg whitespace-nowrap">{formatCurrency(totalValue)}</div>
            <ChevronDown
              className={cn(
                "h-5 w-5 transition-transform",
                isExpanded("echo") ? "transform rotate-0" : "transform -rotate-90"
              )}
            />
          </div>
        </div>
      </CardHeader>

      {isExpanded("echo") && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {sortedPositions.map((position) => (
              <EchoPositionRow
                key={`${position.type ?? "supply"}-${position.positionId}`}
                position={position}
                logoUrl={position.logoUrl || getTokenLogoUrl(position.underlyingAddress, position.symbol)}
              />
            ))}
            {protocol && showManageButton && (
              <ManagePositionsButton protocol={protocol} />
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
