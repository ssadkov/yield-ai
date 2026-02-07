"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { ManagePositionsButton } from "../ManagePositionsButton";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { formatCurrency } from "@/lib/utils/numberFormat";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


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
  const [equity, setEquity] = useState<number | null>(null);
  const [positionsCount, setPositionsCount] = useState(0);
  const [vaults, setVaults] = useState<{ name: string; current_value_of_shares?: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isExpanded, toggleSection } = useCollapsible();
  const protocol = getProtocolByName("Decibel");
  const onValueRef = useRef(onPositionsValueChange);
  const onCompleteRef = useRef(onPositionsCheckComplete);
  onValueRef.current = onPositionsValueChange;
  onCompleteRef.current = onPositionsCheckComplete;

  useEffect(() => {
    if (!address) {
      onCompleteRef.current?.();
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      fetch(`/api/protocols/decibel/accountOverview?address=${encodeURIComponent(address)}`).then((r) =>
        r.json()
      ),
      fetch(`/api/protocols/decibel/userPositions?address=${encodeURIComponent(address)}`).then((r) =>
        r.json()
      ),
      fetch(`/api/protocols/decibel/accountVaultPerformance?address=${encodeURIComponent(address)}`).then((r) =>
        r.json()
      ),
    ])
      .then(([overviewRes, positionsRes, vaultsRes]) => {
        if (cancelled) return;
        const eq =
          overviewRes?.success && overviewRes?.data?.perp_equity_balance != null
            ? Number(overviewRes.data.perp_equity_balance)
            : 0;
        const count = positionsRes?.success && Array.isArray(positionsRes?.data)
          ? positionsRes.data.filter((p: { is_deleted?: boolean }) => !p.is_deleted).length
          : 0;
        const vaultList = vaultsRes?.success && Array.isArray(vaultsRes?.data)
          ? vaultsRes.data.map((v: { vault?: { name?: string }; current_value_of_shares?: number }) => ({
              name: v.vault?.name ?? "Vault",
              current_value_of_shares: v.current_value_of_shares,
            }))
          : [];
        setEquity(eq);
        setPositionsCount(count);
        setVaults(vaultList);
        onValueRef.current?.(eq);
      })
      .catch(() => {
        if (!cancelled) {
          setEquity(0);
          setPositionsCount(0);
          setVaults([]);
          onValueRef.current?.(0);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          onCompleteRef.current?.();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  const displayValue = equity != null ? equity : 0;
  const hasAnything =
    isLoading || positionsCount > 0 || vaults.length > 0 || displayValue > 0;

  if (!address) {
    return null;
  }
  if (!hasAnything) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection("decibel")}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {protocol?.logoUrl && (
              <div className="w-5 h-5 relative">
                <Image
                  src={protocol.logoUrl}
                  alt="Decibel"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
            )}
            <CardTitle className="text-lg">Decibel</CardTitle>
            <Badge variant="secondary" className="text-xs font-normal">
              testnet
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex text-muted-foreground cursor-help">
                    <Info className="h-3.5 w-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px]">
                  <p>Decibel is on testnet. These funds are not included in total assets.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg whitespace-nowrap">
              {isLoading ? "..." : formatCurrency(displayValue)}
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 transition-transform",
                isExpanded("decibel") ? "transform rotate-0" : "transform -rotate-90"
              )}
            />
          </div>
        </div>
      </CardHeader>
      {isExpanded("decibel") && (
        <CardContent className="px-3 pt-0 pb-3">
          <div className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading..."
              : positionsCount === 0
                ? "No open positions"
                : `${positionsCount} position${positionsCount !== 1 ? "s" : ""}`}
          </div>
          {!isLoading && vaults.length > 0 && (
            <div className="mt-4 pt-4 space-y-2">
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Vaults</h4>
              {vaults.map((v, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div className="text-sm font-medium truncate min-w-0">{v.name}</div>
                  <div className="text-sm font-medium shrink-0 ml-2">
                    {v.current_value_of_shares != null && v.current_value_of_shares > 0
                      ? formatCurrency(v.current_value_of_shares, 2)
                      : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex justify-center w-full">
            {showManageButton && protocol && <ManagePositionsButton protocol={protocol} />}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
