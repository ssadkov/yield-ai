import { useEffect, useState } from "react";
import { PositionCard } from "./PositionCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

interface Position {
  market: string;
  coin: string;
  supply: number;
  supplyApr: number;
}

interface TokenInfo {
  symbol: string;
  name: string;
  logoUrl: string | null;
  decimals: number;
  usdPrice: string | null;
}

export function PositionsList({ address, onPositionsValueChange }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Echelon");

  // Функция для поиска информации о токене
  const getTokenInfo = (coinAddress: string): TokenInfo | null => {
    const token = tokenList.data.data.find(
      (t) => t.faAddress === coinAddress || t.tokenAddress === coinAddress
    );
    
    if (token) {
      return {
        symbol: token.symbol,
        name: token.name,
        logoUrl: token.logoUrl || null,
        decimals: token.decimals,
        usdPrice: token.usdPrice || null
      };
    }
    
    return null;
  };

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
        console.log('Echelon API response:', data);
        
        if (data.userPositions) {
          console.log('Setting positions:', data.userPositions);
          setPositions(data.userPositions);
        } else {
          console.log('No valid positions data');
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

  // Считаем общую сумму в долларах
  const totalValue = positions.reduce((sum, position) => {
    const tokenInfo = getTokenInfo(position.coin);
    const amount = position.supply / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
    const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
    return sum + value;
  }, 0);

  // Вызываем колбэк при изменении общей суммы позиций
  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  return (
    <Card className="w-full">
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
            <div className="text-lg">${totalValue.toFixed(2)}</div>
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
            {positions.map((position, index) => {
              const tokenInfo = getTokenInfo(position.coin);
              const amount = position.supply / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
              const value = tokenInfo?.usdPrice ? (amount * parseFloat(tokenInfo.usdPrice)).toFixed(2) : 'N/A';
              
              return (
                <div key={`${position.coin}-${index}`} className="mb-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {tokenInfo?.logoUrl && (
                        <div className="w-6 h-6 relative">
                          <Image 
                            src={tokenInfo.logoUrl} 
                            alt={tokenInfo.symbol}
                            width={24}
                            height={24}
                            className="object-contain"
                          />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium">{tokenInfo?.symbol || position.coin.substring(0, 4).toUpperCase()}</div>
                        <div className="text-xs text-muted-foreground">
                          ${tokenInfo?.usdPrice ? parseFloat(tokenInfo.usdPrice).toFixed(2) : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">${value}</div>
                      <div className="text-xs text-muted-foreground">{amount.toFixed(4)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
} 