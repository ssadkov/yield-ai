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
import { formatCurrency } from "@/lib/utils/numberFormat";
import { Badge } from "@/components/ui/badge";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
}

interface TokenAmount {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string | null;
  amountRaw: string;
  amount: number;
  priceUSD: number;
  valueUSD: number;
}

interface RewardItem {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string | null;
  amountRaw: string;
  amount: number;
  priceUSD: number;
  valueUSD: number;
}

interface ThalaPosition {
  positionId: string;
  poolAddress: string;
  token0: TokenAmount;
  token1: TokenAmount;
  inRange: boolean;
  rewards: RewardItem[];
  positionValueUSD: number;
  rewardsValueUSD: number;
  totalValueUSD: number;
}

function ThalaPositionCard({ position }: { position: ThalaPosition }) {
  return (
    <Card className="w-full mb-3">
      <CardHeader className="flex flex-row items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="flex">
              {position.token0.logoUrl && (
                <div className="w-6 h-6 rounded-full overflow-hidden border border-white">
                  <img src={position.token0.logoUrl} alt={position.token0.symbol} className="w-full h-full object-contain" />
                </div>
              )}
              {position.token1.logoUrl && (
                <div className="w-6 h-6 -ml-2 rounded-full overflow-hidden border border-white">
                  <img src={position.token1.logoUrl} alt={position.token1.symbol} className="w-full h-full object-contain" />
                </div>
              )}
            </div>
            {position.inRange ? (
              <Badge variant="outline" className="mt-1 py-0 h-5 bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-1 py-0 h-5 bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                Inactive
              </Badge>
            )}
          </div>
          <div className="flex flex-col ml-1">
            <div className="text-sm font-medium">
              {position.token0.symbol}/{position.token1.symbol}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-base font-medium">{formatCurrency(position.positionValueUSD, 2)}</div>
        </div>
      </CardHeader>
    </Card>
  );
}

export function PositionsList({ address, onPositionsValueChange, refreshKey, onPositionsCheckComplete, showManageButton = true }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<ThalaPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isExpanded, toggleSection } = useCollapsible();

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Thala");

  useEffect(() => {
    async function loadPositions() {
      if (!walletAddress) {
        setPositions((prev) => prev);
        onPositionsCheckComplete?.();
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/protocols/thala/userPositions?address=${walletAddress}`);

        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }

        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setPositions(data.data);
        } else {
          setPositions([]);
        }
      } catch (err) {
        setError('Failed to load positions');
      } finally {
        setLoading(false);
        onPositionsCheckComplete?.();
      }
    }

    loadPositions();
  }, [walletAddress, refreshKey]);

  const totalValue = positions.reduce((sum, position) => sum + (position.positionValueUSD || 0), 0);
  const totalRewardsValue = positions.reduce((sum, position) => sum + (position.rewardsValueUSD || 0), 0);

  const sortedPositions = [...positions].sort((a, b) => (b.positionValueUSD || 0) - (a.positionValueUSD || 0));

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
        onClick={() => toggleSection('thala')}
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
            <CardTitle className="text-lg">Thala</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg whitespace-nowrap">{formatCurrency(totalValue)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('thala') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>

      {isExpanded('thala') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {sortedPositions.map((position) => (
              <ThalaPositionCard key={position.positionId} position={position} />
            ))}
            {totalRewardsValue > 0 && (
              <div className="flex">
                <div className="flex items-left">
                  <div className="text-sm text-muted-foreground text-right pl-3">
                    {"💰 Total rewards:"}
                  </div>
                </div>
                <div className="flex-2 items-right">
                  <div className="text-sm font-medium text-right whitespace-nowrap">
                    {formatCurrency(totalRewardsValue, 2)}
                  </div>
                </div>
              </div>
            )}
            {protocol && showManageButton && (
              <ManagePositionsButton protocol={protocol} />
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
