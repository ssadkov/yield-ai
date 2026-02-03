"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import { ManagePositionsButton } from "../ManagePositionsButton";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { formatCurrency } from "@/lib/utils/numberFormat";

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
}

function EchoPositionCard({ position }: { position: EchoPosition }) {
  return (
    <Card className="w-full mb-3">
      <CardHeader className="flex flex-row items-center justify-between py-2">
        <div className="flex items-center gap-2">
          {position.logoUrl ? (
            <div className="w-6 h-6 rounded-full overflow-hidden border border-white">
              <img
                src={position.logoUrl}
                alt={position.symbol}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {position.symbol.slice(0, 2)}
            </div>
          )}
          <div className="text-sm font-medium">{position.symbol}</div>
        </div>
        <div className="text-base font-medium">{formatCurrency(position.valueUSD, 2)}</div>
      </CardHeader>
    </Card>
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
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const myId = ++requestIdRef.current;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        controller.abort();
      }
    }, 25000);

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
        if (cancelled || myId !== requestIdRef.current) return;
        if (data.success && Array.isArray(data.data)) {
          setPositions(data.data);
        } else {
          setPositions([]);
        }
      } catch (err) {
        if (cancelled || myId !== requestIdRef.current) return;
        if (err instanceof Error && err.name === "AbortError") {
          setPositions([]);
        } else {
          setError("Failed to load positions");
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled && myId === requestIdRef.current) {
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

  const totalValue = positions.reduce((sum, p) => sum + (p.valueUSD || 0), 0);
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
              <EchoPositionCard key={position.positionId} position={position} />
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
