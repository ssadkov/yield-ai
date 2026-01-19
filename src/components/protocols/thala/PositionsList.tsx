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
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

function formatCurrencyValue(value: number) {
  if (value === 0) return '$0.00';
  if (value > 0 && value < 0.01) return '< $0.01';
  return formatCurrency(value);
}

function ThalaPositionCard({ position }: { position: ThalaPosition }) {
  const tokenEntries = [
    { symbol: position.token0.symbol, amount: position.token0.amount, value: position.token0.valueUSD },
    { symbol: position.token1.symbol, amount: position.token1.amount, value: position.token1.valueUSD }
  ];

  return (
    <div className="mt-2 pb-2 border-b last:border-b-0">
      <div className="flex flex-wrap justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2 mr-2">
            {position.token0.logoUrl && (
              <img
                src={position.token0.logoUrl}
                alt={position.token0.symbol}
                className="w-8 h-8 rounded-full border-2 border-white object-contain"
              />
            )}
            {position.token1.logoUrl && (
              <img
                src={position.token1.logoUrl}
                alt={position.token1.symbol}
                className="w-8 h-8 rounded-full border-2 border-white object-contain"
              />
            )}
          </div>
          <span className="text-lg font-semibold">
            {position.token0.symbol} / {position.token1.symbol}
          </span>
          {position.inRange ? (
            <span className="px-2 py-1 rounded bg-green-500/10 text-green-600 text-xs font-semibold ml-2">Active</span>
          ) : (
            <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-700 text-xs font-semibold ml-2">Out of range</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{formatCurrencyValue(position.positionValueUSD)}</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-between items-start">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {tokenEntries.map((te) => (
            <div key={`amt-${te.symbol}`}>
              <div className="text-gray-500">{te.symbol} Amount</div>
              <div className="font-medium">{formatNumber(te.amount, 6)}</div>
            </div>
          ))}
          {tokenEntries.map((te) => (
            <div key={`val-${te.symbol}`}>
              <div className="text-gray-500">{te.symbol} Value</div>
              <div className="font-medium">{formatCurrencyValue(te.value)}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-end gap-2 text-sm">
          {position.rewards.length > 0 && (
            <div className="mt-2 text-right">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-gray-500 mb-1 cursor-help">
                      Rewards: {formatCurrencyValue(position.rewardsValueUSD)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1 text-xs max-h-48 overflow-auto">
                      {position.rewards.map((reward, rewardIndex) => (
                        <div key={rewardIndex} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {reward.logoUrl && (
                              <img src={reward.logoUrl} alt={reward.symbol} className="w-4 h-4 rounded-full" />
                            )}
                            <span>{reward.symbol}</span>
                          </div>
                          <span className="font-semibold">{formatNumber(reward.amount, 6)}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {!position.inRange && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 text-xs font-normal px-2 py-0.5 h-5 cursor-help">
                    Out of range
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Liquidity is currently outside the active price range</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
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
  }, [walletAddress, refreshKey, onPositionsCheckComplete]);

  const totalValue = positions.reduce((sum, position) => sum + (position.positionValueUSD || 0), 0);
  const totalRewardsValue = positions.reduce((sum, position) => sum + (position.rewardsValueUSD || 0), 0);

  const sortedPositions = [...positions].sort((a, b) => (b.positionValueUSD || 0) - (a.positionValueUSD || 0));

  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  if (loading && positions.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="py-2">
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
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return null;
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
                    Total rewards:
                  </div>
                </div>
                <div className="flex-2 items-right">
                  <div className="text-sm font-medium text-right whitespace-nowrap">
                    {formatCurrency(totalRewardsValue)}
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
