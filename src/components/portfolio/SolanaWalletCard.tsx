import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TokenList } from "@/components/portfolio/TokenList";
import { Token } from "@/lib/types/token";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown } from "lucide-react";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { formatCurrency } from "@/lib/utils/numberFormat";

interface SolanaWalletCardProps {
  tokens: Token[];
  totalValueUsd: number | null;
  isRefreshing?: boolean;
  onRefresh?: () => Promise<void> | void;
}

export function SolanaWalletCard({
  tokens,
  totalValueUsd,
  isRefreshing,
  onRefresh,
}: SolanaWalletCardProps) {
  const { isExpanded, toggleSection } = useCollapsible();

  const displayTotal = useMemo(() => {
    if (typeof totalValueUsd === "number" && Number.isFinite(totalValueUsd)) {
      return formatCurrency(totalValueUsd, 2);
    }
    return "N/A";
  }, [totalValueUsd]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-medium">Solana Assets</span>
        <span className="text-lg font-medium">{displayTotal}</span>
      </div>
      <Card className="w-full h-full flex flex-col">
        <CardHeader
          className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => toggleSection("solana-wallet")}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-purple-500"
              >
                <path d="M21 8V6a2 2 0 0 0-2-2h-4" />
                <path d="M3 8V6a2 2 0 0 1 2-2h4" />
                <rect width="18" height="12" x="3" y="8" rx="2" />
                <path d="M7 14h.01" />
                <path d="M11 14h2" />
              </svg>
              Solana Wallet
            </CardTitle>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="h-4 w-4 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground/60 opacity-80 transition-colors"
                >
                  <RefreshCw
                    className={cn("h-3 w-3", isRefreshing && "animate-spin")}
                  />
                </Button>
              )}
              <ChevronDown
                className={cn(
                  "h-5 w-5 transition-transform",
                  isExpanded("solana-wallet")
                    ? "transform rotate-0"
                    : "transform -rotate-90",
                )}
              />
            </div>
          </div>
        </CardHeader>
        {isExpanded("solana-wallet") && (
          <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
            <ScrollArea className="h-full">
              {tokens.length > 0 ? <TokenList tokens={tokens} /> : null}
            </ScrollArea>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

