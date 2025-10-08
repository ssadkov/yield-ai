import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { useEffect, useState } from "react";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { TokenPrice } from "@/lib/types/panora";
import { createDualAddressPriceMap } from "@/lib/utils/addressNormalization";

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
  logoUrl?: string;
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
  onPositionValueChange?: (value: number) => void;
}

interface Position {
  type: 'lend' | 'borrow';
  key: string;
  amount: number;
  price: string;
  value: number;
  tokenInfo?: Token;
}

export function PositionCard({ position, onPositionValueChange }: PositionProps) {
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [currentTotal, setCurrentTotal] = useState(0);
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
    const arr = Array.from(addresses);
    return arr;
  };

  // Получаем цену токена с учетом префиксов
  const getTokenPrice = (address: string): string => {
    const cleanAddress = address.startsWith('@') ? address.slice(1) : address;
    const fullAddress = cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;
    const price = tokenPrices[fullAddress] || '0';
    return price;
  };

  // Получаем цены токенов через Panora API
  useEffect(() => {
    const fetchPrices = async () => {
      const addresses = getAllTokenAddresses();
      if (addresses.length === 0) return;

      try {
        const response = await pricesService.getPrices(1, addresses);
        if (response.data) {
          // Use utility function to create price map with both address versions
          const prices = createDualAddressPriceMap(response.data);
          setTokenPrices(prices);
        }
      } catch (error) {
        console.error('Failed to fetch token prices:', error);
      }
    };

    fetchPrices();
  }, [position]);

  useEffect(() => {
    if (tokenPrices && Object.keys(tokenPrices).length > 0) {
      const total = calculateTotalValue();
      if (total !== currentTotal) {
        setCurrentTotal(total);
        onPositionValueChange?.(total);
      }
    }
  }, [tokenPrices, onPositionValueChange, currentTotal]);

  // Рассчитываем сумму по Loop Position
  const calculateLoopPositionValue = () => {
    if (!isLoopPosition) return 0;

    let totalValue = 0;

    // Суммируем значения lend позиций
    position.lend_positions.data.forEach(lend => {
      const tokenInfo = getTokenInfo(lend.key);
      const amount = parseFloat(lend.value) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(lend.key);
      totalValue += amount * parseFloat(price);
    });

    // Вычитаем значения borrow позиций
    position.borrow_positions.data.forEach(borrow => {
      const tokenInfo = getTokenInfo(borrow.value.coin_name);
      const amount = parseFloat(borrow.value.borrow_amount) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(borrow.value.coin_name);
      totalValue -= amount * parseFloat(price);
    });

    return totalValue;
  };

  // Рассчитываем общую сумму по всем позициям
  const calculateTotalValue = () => {
    let totalValue = 0;

    // Суммируем значения lend позиций
    position.lend_positions.data.forEach(lend => {
      const tokenInfo = getTokenInfo(lend.key);
      const amount = parseFloat(lend.value) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(lend.key);
      totalValue += amount * parseFloat(price);
    });

    // Вычитаем значения borrow позиций
    position.borrow_positions.data.forEach(borrow => {
      const tokenInfo = getTokenInfo(borrow.value.coin_name);
      const amount = parseFloat(borrow.value.borrow_amount) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(borrow.value.coin_name);
      totalValue -= amount * parseFloat(price);
    });

    return totalValue;
  };

  // Сортируем позиции по значению (от большего к меньшему)
  const getSortedPositions = (): Position[] => {
    const positions: Position[] = [];

    // Добавляем lend позиции
    position.lend_positions.data.forEach(lend => {
      const tokenInfo = getTokenInfo(lend.key);
      const amount = parseFloat(lend.value) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(lend.key);
      const value = amount * parseFloat(price);
      positions.push({
        type: 'lend',
        key: lend.key,
        amount,
        price,
        value,
        tokenInfo
      });
    });

    // Добавляем borrow позиции
    position.borrow_positions.data.forEach(borrow => {
      const tokenInfo = getTokenInfo(borrow.value.coin_name);
      const amount = parseFloat(borrow.value.borrow_amount) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(borrow.value.coin_name);
      const value = amount * parseFloat(price);
      positions.push({
        type: 'borrow',
        key: borrow.value.coin_name,
        amount,
        price,
        value,
        tokenInfo
      });
    });

    // Сортируем по значению (от большего к меньшему)
    return positions.sort((a, b) => b.value - a.value);
  };

  return (
    <Card className="w-full mb-3">
      <CardHeader className="py-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">
                {position.position_name === "Loop-Position" ? "Loop-Position" : "Positions"}
              </div>
            </div>
            {position.position_name === "Loop-Position" && (
              <div className="text-sm text-muted-foreground">
                ${calculateTotalValue().toFixed(2)}
              </div>
            )}
          </div>
          
          {isLoopPosition ? (
            // Для Loop-Position показываем оба актива с пометкой Borrow
            <div className="space-y-2">
              {getSortedPositions().map((pos, index) => (
                <div key={`${pos.type}-${index}`} className="flex items-center justify-between p-2 rounded-lg">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      {pos.tokenInfo?.logoUrl && (
                        <Image
                          src={pos.tokenInfo.logoUrl}
                          alt={pos.tokenInfo.symbol}
                          width={16}
                          height={16}
                          className="rounded-full"
                        />
                      )}
                      <div className={cn("text-sm", pos.type === 'borrow' && "text-red-600")}>
                        {pos.tokenInfo?.symbol || pos.key.split('::').pop()}
                      </div>
                      {pos.type === 'borrow' && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                          Borrow
                        </Badge>
                      )}
                    </div>
                    <div className={cn("text-xs", pos.type === 'borrow' ? "text-red-600/70" : "text-muted-foreground")}>
                      ${parseFloat(pos.price).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className={cn("text-sm", pos.type === 'borrow' && "text-red-600")}>
                      ${pos.value.toFixed(2)}
                    </div>
                    <div className={cn("text-xs", pos.type === 'borrow' ? "text-red-600/70" : "text-muted-foreground")}>
                      {pos.amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Для обычных позиций просто список активов
            <div className="space-y-2">
              {getSortedPositions().map((pos, index) => (
                <div key={`${pos.type}-${index}`} className="flex items-center justify-between p-2 rounded-lg">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      {pos.tokenInfo?.logoUrl && (
                        <Image
                          src={pos.tokenInfo.logoUrl}
                          alt={pos.tokenInfo.symbol}
                          width={16}
                          height={16}
                          className="rounded-full"
                        />
                      )}
                      <div className={cn("text-sm", pos.type === 'borrow' && "text-red-600")}>
                        {pos.tokenInfo?.symbol || pos.key.split('::').pop()}
                      </div>
                      {pos.type === 'borrow' && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                          Borrow
                        </Badge>
                      )}
                    </div>
                    <div className={cn("text-xs", pos.type === 'borrow' ? "text-red-600/70" : "text-muted-foreground")}>
                      ${parseFloat(pos.price).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className={cn("text-sm", pos.type === 'borrow' && "text-red-600")}>
                      ${pos.value.toFixed(2)}
                    </div>
                    <div className={cn("text-xs", pos.type === 'borrow' ? "text-red-600/70" : "text-muted-foreground")}>
                      {pos.amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
} 