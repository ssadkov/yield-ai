"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatNumber } from "@/lib/utils/numberFormat";

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

function sortByValueDesc(items: AptreePosition[]): AptreePosition[] {
  return [...items].sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
}

export function AptreePositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<AptreePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aprPct, setAprPct] = useState<number | null>(null);

  const loadPositions = async () => {
    if (!account?.address) {
      setPositions([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [positionsResponse, poolsResponse] = await Promise.all([
        fetch(`/api/protocols/aptree/userPositions?address=${encodeURIComponent(account.address.toString())}`),
        fetch(`/api/protocols/aptree/pools`),
      ]);
      if (!positionsResponse.ok) throw new Error("Failed to fetch");
      const data = await positionsResponse.json();
      const poolsData = await poolsResponse.json().catch(() => null);
      const firstPool = Array.isArray(poolsData?.data) ? poolsData.data[0] : null;
      const aprRaw = Number(firstPool?.apr);
      // Route returns APR as decimal (e.g. 0.12 => 12%)
      setAprPct(Number.isFinite(aprRaw) ? aprRaw * 100 : null);
      if (data?.success && Array.isArray(data.data)) {
        setPositions(sortByValueDesc(data.data));
      } else {
        setPositions([]);
      }
    } catch {
      setError("Failed to load APTree positions");
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPositions();
    const handleRefresh: EventListener = (evt) => {
      const event = evt as CustomEvent<{ protocol: string; data?: AptreePosition[] }>;
      if (event?.detail?.protocol === "aptree") {
        if (Array.isArray(event.detail.data)) {
          setPositions(sortByValueDesc(event.detail.data));
        } else {
          void loadPositions();
        }
      }
    };
    window.addEventListener("refreshPositions", handleRefresh);
    return () => window.removeEventListener("refreshPositions", handleRefresh);
  }, [account?.address]);

  const sortedPositions = useMemo(() => sortByValueDesc(positions), [positions]);
  const totalValue = useMemo(
    () => sortedPositions.reduce((sum, p) => sum + Number(p.value || 0), 0),
    [sortedPositions]
  );

  if (loading) {
    return <div className="py-4 text-muted-foreground">Loading positions...</div>;
  }
  if (error) {
    return <div className="py-4 text-red-500">{error}</div>;
  }
  if (sortedPositions.length === 0) {
    return <div className="py-4 text-muted-foreground">No positions on APTree.</div>;
  }

  return (
    <div className="space-y-4 text-base">
      <ScrollArea className="max-h-[420px]">
        {sortedPositions.map((position, index) => {
          const decimals = position.assetInfo?.decimals ?? 6;
          const amountFromBalance = Number(position.balance || 0) / Math.pow(10, decimals);
          const value = Number(position.value || 0);
          const amount = Number(position.displayAmount || amountFromBalance);
          const price = Number.isFinite(Number(position.displayPrice))
            ? Number(position.displayPrice)
            : amount > 0
              ? value / amount
              : 0;
          const symbol = position.assetInfo?.symbol || position.assetName || "USDT";
          const logoUrl =
            position.assetInfo?.logoUrl || "https://assets.panora.exchange/tokens/aptos/USDT.svg";
          return (
            <div key={`${position.poolId}-${index}`} className="p-3 sm:p-4 border-b last:border-b-0">
              {/* Desktop Layout (match Moar structure) */}
              <div className="hidden sm:flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 relative">
                    <Image src={logoUrl} alt={symbol} width={32} height={32} className="object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-semibold">{symbol}</div>
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5"
                      >
                        Supply
                      </Badge>
                    </div>
                    <div className="text-base text-muted-foreground mt-0.5">{formatCurrency(price, 4)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2 mb-1">
                    {aprPct != null && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-2 py-0.5 h-5 cursor-help"
                            >
                              APR: {formatNumber(aprPct, 2)}%
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              <div className="font-semibold">APR Breakdown</div>
                              <div className="flex justify-between gap-3">
                                <span>APTree Earn APR:</span>
                                <span>{formatNumber(aprPct, 2)}%</span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <div className="text-lg font-bold text-right w-24">{formatCurrency(value, 2)}</div>
                  </div>
                  <div className="text-base text-muted-foreground font-semibold">{formatNumber(amount, 4)}</div>
                </div>
              </div>

              {/* Mobile Layout (match Moar structure) */}
              <div className="block sm:hidden space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 relative">
                      <Image src={logoUrl} alt={symbol} width={32} height={32} className="object-contain" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-base font-semibold">{symbol}</div>
                        <Badge
                          variant="outline"
                          className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-1.5 py-0.5 h-4"
                        >
                          Supply
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{formatCurrency(price, 4)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2 mb-1">
                      {aprPct != null && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-1.5 py-0.5 h-4 cursor-help"
                              >
                                APR: {formatNumber(aprPct, 2)}%
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs space-y-1">
                                <div className="font-semibold">APR Breakdown</div>
                                <div className="flex justify-between gap-3">
                                  <span>APTree Earn APR:</span>
                                  <span>{formatNumber(aprPct, 2)}%</span>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <div className="text-base font-semibold text-right w-24">{formatCurrency(value, 2)}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">{formatNumber(amount, 4)}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </ScrollArea>
      <div className="flex items-center justify-between pt-6 pb-6">
        <span className="text-xl">Total assets in APTree:</span>
        <span className="text-xl text-primary font-bold">{formatCurrency(totalValue, 2)}</span>
      </div>
    </div>
  );
}
