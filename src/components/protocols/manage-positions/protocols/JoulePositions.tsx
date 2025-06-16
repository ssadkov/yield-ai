'use client';

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Position {
  position_name: string;
  borrow_positions: {
    data: Array<{
      key: string;
      value: {
        borrow_amount: string;
        coin_name: string;
        interest_accumulated: string;
      }
    }>
  };
  lend_positions: {
    data: Array<{
      key: string;
      value: string;
    }>
  };
}

export function JoulePositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);

  useEffect(() => {
    async function loadPositions() {
      if (!account?.address) {
        setPositions([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/protocols/joule/userPositions?address=${account.address}`);
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.userPositions?.[0]?.positions_map?.data) {
          const positionsData = data.userPositions[0].positions_map.data.map((item: any) => item.value);
          setPositions(positionsData);

          // Рассчитываем общую стоимость позиций
          let total = 0;
          positionsData.forEach((position: Position) => {
            // Добавляем стоимость кредитных позиций
            position.lend_positions.data.forEach(lend => {
              const tokenInfo = getTokenInfo(lend.key);
              if (tokenInfo?.usdPrice) {
                const amount = parseFloat(lend.value) / (tokenInfo.decimals ? 10 ** tokenInfo.decimals : 1e8);
                total += amount * parseFloat(tokenInfo.usdPrice);
              }
            });

            // Вычитаем стоимость заемных позиций
            position.borrow_positions.data.forEach(borrow => {
              const tokenInfo = getTokenInfo(borrow.value.coin_name);
              if (tokenInfo?.usdPrice) {
                const amount = parseFloat(borrow.value.borrow_amount) / (tokenInfo.decimals ? 10 ** tokenInfo.decimals : 1e8);
                total -= amount * parseFloat(tokenInfo.usdPrice);
              }
            });
          });
          setTotalValue(total);
        } else {
          setPositions([]);
        }
      } catch (err) {
        console.error('Error loading Joule positions:', err);
        setError('Failed to load positions');
        setPositions([]);
      } finally {
        setLoading(false);
      }
    }

    loadPositions();
  }, [account?.address]);

  const getTokenInfo = (coinName: string) => {
    // Убираем префикс @ если он есть
    const cleanAddress = coinName.startsWith('@') ? coinName.slice(1) : coinName;
    // Добавляем префикс 0x если его нет
    const fullAddress = cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;
    
    const token = (tokenList as any).data.data.find((token: any) => 
      token.tokenAddress === fullAddress || 
      token.faAddress === fullAddress ||
      token.symbol === coinName
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
      <div className="p-4 border-b">
        <div className="text-sm font-medium">Total Value</div>
        <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
      </div>
      <ScrollArea className="h-[400px]">
        {positions.map((position, index) => {
          // Рассчитываем стоимость позиции
          let positionValue = 0;
          position.lend_positions.data.forEach(lend => {
            const tokenInfo = getTokenInfo(lend.key);
            if (tokenInfo?.usdPrice) {
              const amount = parseFloat(lend.value) / (tokenInfo.decimals ? 10 ** tokenInfo.decimals : 1e8);
              positionValue += amount * parseFloat(tokenInfo.usdPrice);
            }
          });
          position.borrow_positions.data.forEach(borrow => {
            const tokenInfo = getTokenInfo(borrow.value.coin_name);
            if (tokenInfo?.usdPrice) {
              const amount = parseFloat(borrow.value.borrow_amount) / (tokenInfo.decimals ? 10 ** tokenInfo.decimals : 1e8);
              positionValue -= amount * parseFloat(tokenInfo.usdPrice);
            }
          });

          return (
            <div key={`${position.position_name}-${index}`} className="p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium">{position.position_name}</h3>
                <div className="text-sm font-medium">${positionValue.toFixed(2)}</div>
              </div>
              
              {/* Borrow Positions */}
              {position.borrow_positions.data.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-muted-foreground mb-2">Borrowed</div>
                  {position.borrow_positions.data.map((borrow, idx) => {
                    const tokenInfo = getTokenInfo(borrow.value.coin_name);
                    const amount = parseFloat(borrow.value.borrow_amount) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
                    const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
                    
                    return (
                      <div 
                        key={`borrow-${borrow.key}-${idx}`}
                        className="p-3 bg-red-50 rounded mb-2"
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
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <div className="text-sm text-red-500">{tokenInfo?.symbol || borrow.value.coin_name.split('::').pop()}</div>
                                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                                  Borrow
                                </Badge>
                              </div>
                              <div className="text-xs text-red-400">
                                ${tokenInfo?.usdPrice ? parseFloat(tokenInfo.usdPrice).toFixed(2) : 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-red-500">${value.toFixed(2)}</div>
                            <div className="text-xs text-red-400">{amount.toFixed(4)}</div>
                            <div className="text-xs text-red-400">
                              Interest: {parseFloat(borrow.value.interest_accumulated).toFixed(4)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Lend Positions */}
              {position.lend_positions.data.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Supplied</div>
                  {position.lend_positions.data.map((lend, idx) => {
                    const tokenInfo = getTokenInfo(lend.key);
                    const amount = parseFloat(lend.value) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
                    const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
                    
                    return (
                      <div 
                        key={`lend-${lend.key}-${idx}`}
                        className="p-3 bg-green-50 rounded mb-2"
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
                            <div className="flex flex-col">
                              <div className="text-sm">{tokenInfo?.symbol || lend.key.split('::').pop()}</div>
                              <div className="text-xs text-muted-foreground">
                                ${tokenInfo?.usdPrice ? parseFloat(tokenInfo.usdPrice).toFixed(2) : 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm">${value.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">{amount.toFixed(4)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {index < positions.length - 1 && <Separator className="my-4" />}
            </div>
          );
        })}
      </ScrollArea>
    </Card>
  );
} 