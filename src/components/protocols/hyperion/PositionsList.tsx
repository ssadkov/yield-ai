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

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

export function PositionsList({ address, onPositionsValueChange }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isExpanded, toggleSection } = useCollapsible();

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Hyperion");

  useEffect(() => {
    async function loadPositions() {
      if (!walletAddress) {
        setPositions([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/protocols/hyperion/userPositions?address=${walletAddress}`);
        
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
        console.error('Error loading Hyperion positions:', err);
        setError('Failed to load positions');
        setPositions([]);
      } finally {
        setLoading(false);
      }
    }

    loadPositions();
  }, [walletAddress]);

  // Считаем общую стоимость всех позиций и наград
  const totalValue = positions.reduce((sum, position) => {
    const positionValue = parseFloat(position.value || "0");
    
    // Считаем награды из фарма
    const farmRewards = position.farm?.unclaimed?.reduce((rewardSum: number, reward: { amountUSD: string }) => {
      return rewardSum + parseFloat(reward.amountUSD || "0");
    }, 0) || 0;
    
    // Считаем награды из комиссий
    const feeRewards = position.fees?.unclaimed?.reduce((feeSum: number, fee: { amountUSD: string }) => {
      return feeSum + parseFloat(fee.amountUSD || "0");
    }, 0) || 0;
    
    return sum + positionValue + farmRewards + feeRewards;
  }, 0);
  
  // Считаем общую стоимость всех позиций и наград
  const totalRewardsValue = positions.reduce((sum, position) => {
  
    // Считаем награды из фарма
    const farmRewards = position.farm?.unclaimed?.reduce((rewardSum: number, reward: { amountUSD: string }) => {
      return rewardSum + parseFloat(reward.amountUSD || "0");
    }, 0) || 0;
    
    // Считаем награды из комиссий
    const feeRewards = position.fees?.unclaimed?.reduce((feeSum: number, fee: { amountUSD: string }) => {
      return feeSum + parseFloat(fee.amountUSD || "0");
    }, 0) || 0;
    
    return sum + farmRewards + feeRewards;
  }, 0);

  // Вызываем колбэк при изменении общей суммы позиций
  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading positions...</div>;
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

  // Сортируем позиции по убыванию общей стоимости (включая награды)
  const sortedPositions = [...positions].sort((a, b) => {
    const aValue = parseFloat(a.value || "0") + parseFloat(a.rewards?.value || "0");
    const bValue = parseFloat(b.value || "0") + parseFloat(b.rewards?.value || "0");
    return bValue - aValue;
  });

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('hyperion')}
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
            <CardTitle className="text-lg">Hyperion</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg">${totalValue.toFixed(2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('hyperion') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded('hyperion') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {sortedPositions.map((position, index) => (
              <PositionCard key={`${position.assetName}-${index}`} position={position} />
            ))}
			<div className="flex">
             <div className="flex items-left">
			   <div className="text-sm text-muted-foreground text-right pl-3">
                 {"💰 Total rewards:"}
               </div>
			 </div>
             <div className="flex-2 items-right">
               <div className="text-sm font-medium text-right">
                 ${totalRewardsValue.toFixed(2)}
               </div>
			 </div>
            </div>
            {protocol && <ManagePositionsButton protocol={protocol} />}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
} 