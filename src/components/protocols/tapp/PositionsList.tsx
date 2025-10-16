import { useEffect, useState } from "react";
import { PositionCard } from "./PositionCard";
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
}

interface Position {
  positionAddr: string;
  poolId: string;
  poolType: string;
  feeTier: string;
  tvl: string;
  volume24h: string;
  shareOfPool: string;
  apr: {
    totalAprPercentage: string;
    feeAprPercentage: string;
    boostedAprPercentage: string;
    campaignAprs: Array<{
      aprPercentage: string;
      campaignIdx: string;
      token: {
        addr: string;
        decimals: number;
        img: string;
        symbol: string;
        verified: boolean;
      };
    }>;
  };
  initialDeposits: Array<{
    addr: string;
    amount: string;
    decimals: number;
    idx: number;
    img: string;
    symbol: string;
    usd: string;
    verified: boolean;
  }>;
  estimatedWithdrawals: Array<{
    addr: string;
    amount: string;
    decimals: number;
    idx: number;
    img: string;
    symbol: string;
    usd: string;
    verified: boolean;
  }>;
  totalEarnings: Array<{
    addr: string;
    amount: string;
    decimals: number;
    idx: number;
    img: string;
    symbol: string;
    usd: string;
    verified: boolean;
  }>;
  estimatedIncentives: Array<{
    addr: string;
    amount: string;
    decimals: number;
    idx: number;
    img: string;
    symbol: string;
    usd: string;
    verified: boolean;
  }>;
}

export function PositionsList({ address, onPositionsValueChange, refreshKey, onPositionsCheckComplete, showManageButton=true }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isExpanded, toggleSection } = useCollapsible();

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Tapp Exchange");

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
        const response = await fetch(`/api/protocols/tapp/userPositions?address=${walletAddress}`);
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json();
        // // console.log('Tapp API response:', data);
        
        if (data.success && Array.isArray(data.data)) {
          // console.log('Setting positions:', data.data);
          setPositions(data.data);
        } else {
          // console.log('No valid positions data');
          setPositions([]);
        }
      } catch (err) {
        // console.error('Error loading Tapp positions:', err);
        setError('Failed to load positions');
        // keep previous positions on error
      } finally {
        setLoading(false);
        onPositionsCheckComplete?.();
      }
    }

    loadPositions();
  }, [walletAddress, refreshKey]);

  // Считаем общую сумму в долларах (позиции + награды)
  const totalValue = positions.reduce((sum, position) => {
    // Стоимость позиции
    const positionValue = position.estimatedWithdrawals.reduce((tokenSum, token) => {
      return tokenSum + parseFloat(token.usd || "0");
    }, 0);
    
    // Награды (стимулы)
    const incentivesValue = position.estimatedIncentives.reduce((incentiveSum, incentive) => {
      return incentiveSum + parseFloat(incentive.usd || "0");
    }, 0);
    
    return sum + positionValue + incentivesValue;
  }, 0);
  
  // Считаем общую сумму в долларах (позиции + награды)
  const totalRewardsValue = positions.reduce((sum, position) => {

    // Награды (стимулы)
    const incentivesValue = position.estimatedIncentives.reduce((incentiveSum, incentive) => {
      return incentiveSum + parseFloat(incentive.usd || "0");
    }, 0);
    
    return sum + incentivesValue;
  }, 0);

  // Сортируем позиции по значению от большего к меньшему
  const sortedPositions = [...positions].sort((a, b) => {
    const aValue = a.estimatedWithdrawals.reduce((sum, token) => sum + parseFloat(token.usd || "0"), 0) +
                   a.estimatedIncentives.reduce((sum, incentive) => sum + parseFloat(incentive.usd || "0"), 0);
    const bValue = b.estimatedWithdrawals.reduce((sum, token) => sum + parseFloat(token.usd || "0"), 0) +
                   b.estimatedIncentives.reduce((sum, incentive) => sum + parseFloat(incentive.usd || "0"), 0);
    return bValue - aValue;
  });

  // Вызываем колбэк при изменении общей суммы позиций
  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  // Если нет позиций, не отображаем блок
  if (positions.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('tapp')}
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
            <CardTitle className="text-lg">Tapp Exchange</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg whitespace-nowrap">{formatCurrency(totalValue)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('tapp') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded('tapp') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {sortedPositions.map((position, index) => (
              <PositionCard key={`${position.positionAddr}-${index}`} position={position} />
            ))}
			<div className="flex">
             <div className="flex items-left">
			   <div className="text-sm text-muted-foreground text-right pl-3">
                 {"💰 Total rewards:"}
               </div>
			 </div>
             <div className="flex-2 items-right">
               <div className="text-sm font-medium text-right whitespace-nowrap">
                 {formatCurrency(totalRewardsValue)}
               </div>
			 </div>
            </div>
            {protocol && showManageButton && (
              <ManagePositionsButton protocol={protocol} />
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
} 