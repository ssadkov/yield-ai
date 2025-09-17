'use client';

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";

interface TokenInfo {
  address: string;
  symbol: string;
  logoUrl?: string;
  decimals: number;
}

interface Position {
  assetName: string;
  balance: string;
  value: string;
  type: 'deposit' | 'borrow';
  assetInfo: {
    name: string;
    symbol: string;
    decimals: number;
    price: string;
  };
}

export function AriesPositions() {
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
        const response = await fetch(`/api/protocols/aries/userPositions?address=${account.address}`);
        
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
        console.error('Error loading Aries positions:', err);
        setError('Failed to load positions');
        setPositions([]);
      } finally {
        setLoading(false);
      }
    }

    loadPositions();
  }, [account?.address]);

  const getTokenInfo = (assetName: string): TokenInfo | undefined => {
    const token = (tokenList as any).data.data.find((token: any) => token.tokenAddress === assetName);
    if (!token) return undefined;
    
    return {
      address: token.tokenAddress,
      symbol: token.symbol,
      logoUrl: token.logoUrl,
      decimals: token.decimals
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
          const tokenInfo = getTokenInfo(position.assetName);
          const amount = parseFloat(position.balance) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
          const value = parseFloat(position.value);
          const isBorrow = position.type === 'borrow';
          
          return (
            <div 
              key={`${position.assetName}-${index}`} 
              className={cn(
                "p-4 border-b last:border-b-0",
                isBorrow && "bg-red-50"
              )}
            >
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
                    <div className={cn(
                      "text-sm font-medium",
                      isBorrow && "text-error"
                    )}>{position.assetName}</div>
                    {isBorrow && (
                      <div className="text-xs px-1.5 py-0.5 rounded bg-error-muted text-error border border-error/20">
                        Borrow
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "text-sm font-medium",
                    isBorrow && "text-red-500"
                  )}>${value.toFixed(2)}</div>
                  <div className={cn(
                    "text-xs",
                    isBorrow ? "text-red-400" : "text-muted-foreground"
                  )}>{amount.toFixed(4)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </ScrollArea>
    </Card>
  );
} 