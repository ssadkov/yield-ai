'use client';

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Position {
  coin: string;
  supply: string;
}

export function EchelonPositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);

  useEffect(() => {
    const fetchPositions = async () => {
      if (!account?.address) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/protocols/echelon/userPositions?address=${account.address}`);
        const data = await response.json();
        console.log('Echelon positions response:', data);
        
        if (data.success && Array.isArray(data.data)) {
          const positionsWithValue = data.data.map((position: any) => ({
            ...position,
            value: Number(position.amount) * Number(position.price)
          }));
          setPositions(positionsWithValue);
        } else {
          console.error('Invalid data format:', data);
          setPositions([]);
        }
      } catch (error) {
        console.error('Error fetching Echelon positions:', error);
        setPositions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
  }, [account?.address]);

  const getTokenInfo = (coinAddress: string) => {
    const token = (tokenList as any).data.data.find(
      (t: any) => t.faAddress === coinAddress || t.tokenAddress === coinAddress
    );
    if (!token) return undefined;
    return {
      address: token.tokenAddress,
      symbol: token.symbol,
      logoUrl: token.logoUrl,
      decimals: token.decimals,
      usdPrice: token.usdPrice
    };
  };

  // Сортируем позиции по значению от большего к меньшему
  const sortedPositions = [...positions].sort((a, b) => {
    const tokenInfoA = getTokenInfo(a.coin);
    const tokenInfoB = getTokenInfo(b.coin);
    const amountA = parseFloat(a.supply) / (tokenInfoA?.decimals ? 10 ** tokenInfoA.decimals : 1e8);
    const amountB = parseFloat(b.supply) / (tokenInfoB?.decimals ? 10 ** tokenInfoB.decimals : 1e8);
    const valueA = tokenInfoA?.usdPrice ? amountA * parseFloat(tokenInfoA.usdPrice) : 0;
    const valueB = tokenInfoB?.usdPrice ? amountB * parseFloat(tokenInfoB.usdPrice) : 0;
    return valueB - valueA;
  });

  // Считаем общую сумму
  useEffect(() => {
    const total = sortedPositions.reduce((sum, position) => {
      const tokenInfo = getTokenInfo(position.coin);
      const amount = parseFloat(position.supply) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
      return sum + value;
    }, 0);
    setTotalValue(total);
  }, [sortedPositions]);

  if (loading) {
    return <div>Loading positions...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (positions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[400px]">
        {sortedPositions.map((position, index) => {
          const tokenInfo = getTokenInfo(position.coin);
          const amount = parseFloat(position.supply) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
          const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
          
          return (
            <div key={`${position.coin}-${index}`} className="p-4 border-b last:border-b-0">
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
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                        Supply
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        ${tokenInfo?.usdPrice ? parseFloat(tokenInfo.usdPrice).toFixed(2) : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">${value.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{amount.toFixed(4)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </ScrollArea>
      <div className="text-lg font-bold text-primary">
        Total assets in Echelon: ${totalValue.toFixed(2)}
      </div>
    </div>
  );
} 