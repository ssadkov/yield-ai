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
  mockData?: any;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
}

export function PositionsList({ address, onPositionsValueChange, mockData, refreshKey, onPositionsCheckComplete, showManageButton=true }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isExpanded, toggleSection } = useCollapsible();
  const [totalValue, setTotalValue] = useState(0);
  const [positionValues, setPositionValues] = useState<{ [key: string]: number }>({});

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Joule");

  const handlePositionValueChange = (positionKey: string, value: number) => {
    setPositionValues(prev => ({
      ...prev,
      [positionKey]: value
    }));
  };

  useEffect(() => {
    const total = Object.values(positionValues).reduce((sum, value) => sum + value, 0);
    setTotalValue(total);
  }, [positionValues]);

  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

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

        if (mockData) {
          if (mockData.userPositions?.[0]?.positions_map?.data) {
            setPositions(mockData.userPositions[0].positions_map.data);
          }
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/protocols/joule/userPositions?address=${walletAddress}`);
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json();
        // console.log('Joule API response:', data);
        
        if (data.userPositions?.[0]?.positions_map?.data) {
          setPositions(data.userPositions[0].positions_map.data);
        } else {
          setPositions([]);
        }
      } catch (err) {
        // console.error('Error loading Joule positions:', err);
        setError('Failed to load positions');
        // keep previous positions on error
      } finally {
        setLoading(false);
        onPositionsCheckComplete?.();
      }
    }

    loadPositions();
  }, [walletAddress, mockData, refreshKey]);

  if (positions.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('joule')}
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
            <CardTitle className="text-lg">Joule</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg">${totalValue.toFixed(2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('joule') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded('joule') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {positions.map((position, index) => (
              <PositionCard 
                key={`${position.key}-${index}`} 
                position={position.value}
                onPositionValueChange={(value) => handlePositionValueChange(position.key, value)}
              />
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