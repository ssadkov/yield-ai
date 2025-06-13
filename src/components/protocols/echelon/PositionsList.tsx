import { useEffect, useState } from "react";
import { PositionCard } from "./PositionCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";

interface PositionsListProps {
  address?: string;
}

export function PositionsList({ address }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Echelon");

  useEffect(() => {
    async function loadPositions() {
      if (!walletAddress) {
        setPositions([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/protocols/echelon/userPositions?address=${walletAddress}`);
        
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
        console.error('Error loading Echelon positions:', err);
        setError('Failed to load positions');
        setPositions([]);
      } finally {
        setLoading(false);
      }
    }

    loadPositions();
  }, [walletAddress]);

  // Считаем общую стоимость всех позиций по типу (supply/borrow)
  const supplyValue = positions
    .filter(position => position.assetType === 'supply')
    .reduce((sum, position) => sum + parseFloat(position.value || "0"), 0);

  const borrowValue = positions
    .filter(position => position.assetType === 'borrow')
    .reduce((sum, position) => sum + parseFloat(position.value || "0"), 0);

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
    return <div className="text-sm text-muted-foreground">No positions found</div>;
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
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
            <CardTitle className="text-lg">Echelon</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <span className="text-base text-green-600">Supply: ${supplyValue.toFixed(2)}</span>
              {borrowValue > 0 && (
                <span className="text-base text-red-600">Borrow: ${borrowValue.toFixed(2)}</span>
              )}
            </div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {positions.map((position, index) => (
              <PositionCard key={`${position.assetName}-${position.assetType}-${index}`} position={position} />
            ))}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
} 