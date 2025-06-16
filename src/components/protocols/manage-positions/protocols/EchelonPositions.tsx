'use client';

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";

interface Position {
  coin: string;
  supply: string;
}

export function EchelonPositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPositions() {
      if (!account?.address) {
        setPositions([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/protocols/echelon/userPositions?address=${account.address}`);
        
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
  }, [account?.address]);

  const getTokenInfo = (coinName: string) => {
    const token = (tokenList as any).data.data.find((token: any) => token.symbol === coinName);
    if (!token) return undefined;
    
    return {
      address: token.tokenAddress,
      symbol: token.symbol,
      logoUrl: token.logoUrl,
      decimals: token.decimals,
      usdPrice: token.usdPrice
    };
  };

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
    <Card className="w-full">
      <ScrollArea className="h-[400px]">
        {positions.map((position, index) => {
          const tokenInfo = getTokenInfo(position.coin);
          const amount = parseFloat(position.supply) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
          const value = tokenInfo?.usdPrice ? (amount * parseFloat(tokenInfo.usdPrice)).toFixed(2) : 'N/A';
          
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
    </Card>
  );
} 