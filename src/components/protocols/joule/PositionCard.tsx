import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { useEffect, useState } from "react";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { TokenPrice } from "@/lib/types/panora";

interface Token {
  chainId: number;
  panoraId: string;
  tokenAddress: string;
  faAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  bridge: null;
  panoraSymbol: string;
  usdPrice: string;
  isBanned: boolean;
}

interface PositionProps {
  position: {
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
  };
}

export function PositionCard({ position }: PositionProps) {
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const pricesService = PanoraPricesService.getInstance();

  const getTokenInfo = (coinName: string): Token | undefined => {
    // Убираем префикс @ если он есть
    const cleanAddress = coinName.startsWith('@') ? coinName.slice(1) : coinName;
    // Добавляем префикс 0x если его нет
    const fullAddress = cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;
    
    return (tokenList.data.data as Token[]).find(token => 
      token.tokenAddress === fullAddress || token.faAddress === fullAddress
    );
  };

  const isLoopPosition = position.position_name === "Loop-Position";

  // Получаем все уникальные адреса токенов
  const getAllTokenAddresses = () => {
    const addresses = new Set<string>();
    
    position.borrow_positions.data.forEach(borrow => {
      const cleanAddress = borrow.value.coin_name.startsWith('@') ? borrow.value.coin_name.slice(1) : borrow.value.coin_name;
      const fullAddress = cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;
      addresses.add(fullAddress);
    });
    
    position.lend_positions.data.forEach(lend => {
      const cleanAddress = lend.key.startsWith('@') ? lend.key.slice(1) : lend.key;
      const fullAddress = cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;
      addresses.add(fullAddress);
    });
    
    return Array.from(addresses);
  };

  // Получаем цену токена с учетом префиксов
  const getTokenPrice = (address: string): string => {
    const cleanAddress = address.startsWith('@') ? address.slice(1) : address;
    const fullAddress = cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;
    return tokenPrices[fullAddress] || '0';
  };

  // Получаем цены токенов через Panora API
  useEffect(() => {
    const fetchPrices = async () => {
      const addresses = getAllTokenAddresses();
      if (addresses.length === 0) return;

      try {
        const response = await pricesService.getPrices(1, addresses);
        if (response.data) {
          const prices: Record<string, string> = {};
          response.data.forEach((price: TokenPrice) => {
            if (price.tokenAddress) {
              prices[price.tokenAddress] = price.usdPrice;
            }
            if (price.faAddress) {
              prices[price.faAddress] = price.usdPrice;
            }
          });
          setTokenPrices(prices);
        }
      } catch (error) {
        console.error('Error fetching token prices:', error);
      }
    };

    fetchPrices();
  }, [position]);

  return (
    <Card className="w-full mb-3">
      <CardHeader className="py-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{position.position_name}</div>
          </div>
          
          {isLoopPosition ? (
            // Для Loop-Position показываем оба актива с пометкой Borrow
            <div className="space-y-2">
              {position.borrow_positions.data.map((borrow, index) => {
                const tokenInfo = getTokenInfo(borrow.value.coin_name);
                const amount = parseFloat(borrow.value.borrow_amount) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
                const price = getTokenPrice(borrow.value.coin_name);
                const value = amount * parseFloat(price);
                
                return (
                  <div key={`borrow-${index}`} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <div className="text-sm">{tokenInfo?.symbol || borrow.value.coin_name.split('::').pop()}</div>
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                          Borrow
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">${price}</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-sm">${value.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{amount.toFixed(4)}</div>
                    </div>
                  </div>
                );
              })}
              
              {position.lend_positions.data.map((lend, index) => {
                const tokenInfo = getTokenInfo(lend.key);
                const amount = parseFloat(lend.value) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
                const price = getTokenPrice(lend.key);
                const value = amount * parseFloat(price);
                
                return (
                  <div key={`lend-${index}`} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="text-sm">{tokenInfo?.symbol || lend.key.split('::').pop()}</div>
                      <div className="text-xs text-muted-foreground">${price}</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-sm">${value.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{amount.toFixed(4)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Для обычных позиций просто список активов
            <div className="space-y-2">
              {position.lend_positions.data.map((lend, index) => {
                const tokenInfo = getTokenInfo(lend.key);
                const amount = parseFloat(lend.value) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
                const price = getTokenPrice(lend.key);
                const value = amount * parseFloat(price);
                
                return (
                  <div key={`lend-${index}`} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="text-sm">{tokenInfo?.symbol || lend.key.split('::').pop()}</div>
                      <div className="text-xs text-muted-foreground">${price}</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-sm">${value.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{amount.toFixed(4)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
} 