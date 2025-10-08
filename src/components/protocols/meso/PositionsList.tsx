import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ManagePositionsButton } from "../ManagePositionsButton";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import tokenList from "@/lib/data/tokenList.json";
import { getMesoTokenByAddress } from "@/lib/protocols/meso/tokens";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
}

interface Position {
  assetName: string;
  balance: string; // raw base units from asset_amounts
  amount: number;  // normalized by token decimals
  usdValue: number; // normalized by 1e16 from asset_values
  type: 'deposit' | 'debt';
  assetInfo: {
    name: string;
    symbol: string;
    decimals: number;
    logoUrl?: string | null;
  };
}

interface MesoApiResponse {
  success: boolean;
  data: Position[];
}

interface RewardsApiResponse {
  success: boolean;
  rewards: Array<{
    side: 'supply' | 'borrow';
    poolInner: string;
    rewardPoolInner: string;
    tokenAddress: string;
    amount: number;
    symbol: string;
    usdValue: number;
  }>;
  totalUsd: number;
}

function formatTokenAmount(amount: string, decimals: number): string {
  const bigIntAmount = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  
  const wholePart = bigIntAmount / divisor;
  const fractionalPart = bigIntAmount % divisor;
  
  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  return `${wholePart}.${trimmedFractional}`;
}

// Функция для получения информации о токене (без цены)
function getTokenInfo(tokenAddress: string) {
  // Normalize addresses by removing leading zeros after 0x
  const normalizeAddress = (addr: string) => {
    if (!addr || !addr.startsWith('0x')) return addr;
    return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
  };
  
  const normalizedTokenAddress = normalizeAddress(tokenAddress);
  
  const token = (tokenList as { data: { data: Array<{ tokenAddress?: string; faAddress?: string; symbol?: string; name?: string; logoUrl?: string; decimals?: number }> } }).data.data.find((t) => {
    const normalizedTokenListAddress = normalizeAddress(t.tokenAddress || '');
    const normalizedFaAddress = normalizeAddress(t.faAddress || '');
    
    return normalizedTokenListAddress === normalizedTokenAddress || 
           normalizedFaAddress === normalizedTokenAddress;
  });
  
  if (token) {
    return {
      symbol: token.symbol,
      name: token.name,
      logoUrl: token.logoUrl || null,
      decimals: token.decimals,
      usdPrice: null // Цена будет получена динамически
    };
  }
  
  return null;
}

export function PositionsList({ address, onPositionsValueChange, refreshKey, onPositionsCheckComplete, showManageButton=true }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isExpanded, toggleSection } = useCollapsible();
  const [totalValue, setTotalValue] = useState(0);
  const [rewards, setRewards] = useState<RewardsApiResponse | null>(null);

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Meso Finance");

  // Панора цены больше не нужны — значения USD берем из meso view API

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
        // Новый API: берем уже нормализованные amount и usdValue
        const response = await fetch(`/api/protocols/meso/userPositions?address=${walletAddress}`);
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        const data = await response.json() as MesoApiResponse;
        if (data.success && Array.isArray(data.data)) {
          setPositions(data.data);
        } else {
          setPositions([]);
        }
      } catch (err) {
        console.error('Error loading Meso positions:', err);
        setError('Failed to load positions');
        // keep previous positions on error
      } finally {
        setLoading(false);
        onPositionsCheckComplete?.();
      }
    }

    loadPositions();
  }, [walletAddress, refreshKey]);

  // Загружаем награды для отображения в Sidebar
  useEffect(() => {
    const fetchRewards = async () => {
      if (!walletAddress) {
        setRewards(null);
        return;
      }
      try {
        const res = await fetch(`/api/protocols/meso/rewards?address=${walletAddress}`);
        if (!res.ok) throw new Error(`Rewards API ${res.status}`);
        const json = (await res.json()) as RewardsApiResponse;
        if (json?.success) setRewards(json);
        else setRewards({ success: true, rewards: [], totalUsd: 0 });
      } catch (e) {
        console.error('[Meso] Rewards load error:', e);
        setRewards({ success: true, rewards: [], totalUsd: 0 });
      }
    };
    fetchRewards();
  }, [walletAddress]);

  // Пересчитываем общую стоимость при изменении позиций (вычитаем borrow)
  useEffect(() => {
    const sum = positions.reduce((acc, p) => acc + (p.type === 'deposit' ? p.usdValue : -p.usdValue), 0);
    setTotalValue(Math.max(0, sum));
  }, [positions]);

  // Вызываем колбэк при изменении общей суммы позиций
  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  // Если нет позиций, не отображаем блок
  if (positions.length === 0) {
    return null;
  }

  // Сортировка: сначала депозиты, потом займы по убыванию USD
  const sortedPositions = [...positions].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'deposit' ? -1 : 1;
    return b.usdValue - a.usdValue;
  });

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('meso')}
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
            <CardTitle className="text-lg">Meso Finance</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg">${(totalValue + (rewards?.totalUsd || 0)).toFixed(2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('meso') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded('meso') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {sortedPositions.map((position, index) => {
              const amount = position.amount;
              const value = position.usdValue;
              const mapping = getMesoTokenByAddress(position.assetName);
              const symbol = position.assetInfo?.symbol || mapping?.symbol || (position.assetName.length > 14 ? `${position.assetName.slice(0, 14)}…` : position.assetName);
              
              return (
                <div key={`${position.assetName}-${index}`} className="mb-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {position.assetInfo.logoUrl && (
                        <div className="w-6 h-6 relative">
                          <Image 
                            src={position.assetInfo.logoUrl} 
                            alt={position.assetInfo.symbol}
                            width={24}
                            height={24}
                            className="object-contain"
                          />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "text-sm font-medium",
                            position.type === 'debt' && "text-red-500"
                          )}>{symbol}</div>
                          {position.type === 'debt' && (
                            <div className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">
                              Borrow
                            </div>
                          )}
                        </div>
                       <div className="text-xs text-muted-foreground">${amount > 0 ? (value / amount).toFixed(2) : '0.00'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-sm font-medium",
                        position.type === 'debt' && "text-red-500"
                      )}>${value.toFixed(2)}</div>
                      <div className={cn(
                        "text-xs",
                        position.type === 'debt' ? "text-red-400" : "text-muted-foreground"
                      )}>{amount.toFixed(4)}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 💰 Total rewards */}
            {rewards && rewards.rewards && rewards.rewards.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 cursor-help">
                      <span className="text-sm text-muted-foreground">💰 Total rewards:</span>
                      <span className="text-sm font-medium">${rewards.totalUsd.toFixed(2)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <div className="font-medium">Rewards</div>
                      {rewards.rewards
                        .sort((a, b) => b.usdValue - a.usdValue)
                        .map((r, idx) => (
                          <div key={idx} className="text-xs">
                            {r.symbol}: {r.amount.toFixed(6)} (${r.usdValue.toFixed(2)})
                          </div>
                        ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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