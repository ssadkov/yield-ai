import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import { ManagePositionsButton } from "../ManagePositionsButton";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { parseMesoPosition } from "@/lib/protocols/meso/parser";
import tokenList from "@/lib/data/tokenList.json";
import { getMesoTokenByInner } from "@/lib/protocols/meso/tokens";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { TokenPrice } from "@/lib/types/panora";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

interface Position {
  assetName: string;
  balance: string;
  type: 'deposit' | 'debt';
  inner: string;
  assetInfo: {
    name: string;
    symbol: string;
    decimals: number;
    logoUrl?: string | null;
    price?: string;
  };
}

interface MesoResponse {
  data: Array<{
    type: string;
    data: unknown;
  }>;
}

function formatTokenAmount(amount: string, decimals: number): string {
  const bigIntAmount = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  
  const wholePart = bigIntAmount / divisor;
  const fractionalPart = bigIntAmount % divisor;
  
  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  return `${wholePart}.${trimmedFractional}`;
}

// Функция для получения информации о токене (без цены)
function getTokenInfo(tokenAddress: string) {
  const token = (tokenList as { data: { data: Array<{ tokenAddress?: string; faAddress?: string; symbol?: string; name?: string; logoUrl?: string; decimals?: number }> } }).data.data.find((t) =>
    t.tokenAddress === tokenAddress || t.faAddress === tokenAddress
  );
  
  if (token) {
    return {
      symbol: token.symbol,
      name: token.name,
      logoUrl: token.logoUrl || null,
      decimals: token.decimals,
      usdPrice: null // Цена будет получена динамически
    };
  }
  
  return null;
}

export function PositionsList({ address, onPositionsValueChange }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const { isExpanded, toggleSection } = useCollapsible();
  const [totalValue, setTotalValue] = useState(0);
  const pricesService = PanoraPricesService.getInstance();

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Meso Finance");

  // Получаем все уникальные адреса токенов из позиций
  const getAllTokenAddresses = () => {
    const addresses = new Set<string>();

    positions.forEach(position => {
      // Теперь используем position.inner
      let mesoToken = getMesoTokenByInner(position.inner);
      if (mesoToken?.tokenAddress) {
        let cleanAddress = mesoToken.tokenAddress;
        if (cleanAddress.startsWith('@')) {
          cleanAddress = cleanAddress.slice(1);
        }
        if (!cleanAddress.startsWith('0x')) {
          cleanAddress = `0x${cleanAddress}`;
        }
        addresses.add(cleanAddress);
      }
    });
    const arr = Array.from(addresses);
    console.log('[Meso] Token addresses for Panora:', arr);
    return arr;
  };

  // Получаем цену токена из кэша
  const getTokenPrice = (tokenAddress: string): string => {
    let cleanAddress = tokenAddress;
    if (cleanAddress.startsWith('@')) {
      cleanAddress = cleanAddress.slice(1);
    }
    if (!cleanAddress.startsWith('0x')) {
      cleanAddress = `0x${cleanAddress}`;
    }
    const price = tokenPrices[cleanAddress] || '0';
    // Логируем ВСЕ вызовы, не только stAPT
    console.log('[Meso] getTokenPrice:', cleanAddress, '=>', price);
    return price;
  };

  // Получаем цены токенов через Panora API
  useEffect(() => {
    const fetchPrices = async () => {
      const addresses = getAllTokenAddresses();
      if (addresses.length === 0) return;

      try {
        const response = await pricesService.getPrices(1, addresses);
        console.log('[Meso] Panora API response:', response.data);
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
  }, [positions]);

  useEffect(() => {
    async function loadPositions() {
      if (!walletAddress) {
        setPositions([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Получаем ресурсы аккаунта
        const response = await fetch('/api/aptos/resources', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address: walletAddress }),
        });
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json() as MesoResponse;
        console.log('Meso API response:', data);
        
        // Ищем позицию Meso Finance
        const mesoResource = data.data?.find((resource: { type: string; data: unknown }) => 
          resource.type === '0x68476f9d437e3f32fd262ba898b5e3ee0a23a1d586a6cf29a28add35f253f6f7::lending_pool::UserPosition'
        );
        
        if (mesoResource) {
          const parsed = parseMesoPosition(mesoResource.data);
          if (parsed) {
            const newPositions: Position[] = [];
            
            // Добавляем депозиты
            parsed.deposits.forEach(deposit => {
              const mesoToken = getMesoTokenByInner(deposit.inner);
              const tokenInfo = mesoToken ? getTokenInfo(mesoToken.tokenAddress) : undefined;
              
              newPositions.push({
                assetName: deposit.tokenSymbol,
                balance: deposit.shares,
                type: 'deposit',
                inner: deposit.inner, // добавляем inner
                assetInfo: {
                  name: deposit.tokenName,
                  symbol: deposit.tokenSymbol,
                  decimals: deposit.decimals,
                  logoUrl: tokenInfo?.logoUrl,
                  price: undefined // Цена будет получена динамически
                }
              });
            });
            
            // Добавляем займы
            parsed.debts.forEach(debt => {
              const mesoToken = getMesoTokenByInner(debt.inner);
              const tokenInfo = mesoToken ? getTokenInfo(mesoToken.tokenAddress) : undefined;
              
              newPositions.push({
                assetName: debt.tokenSymbol,
                balance: debt.shares,
                type: 'debt',
                inner: debt.inner, // добавляем inner
                assetInfo: {
                  name: debt.tokenName,
                  symbol: debt.tokenSymbol,
                  decimals: debt.decimals,
                  logoUrl: tokenInfo?.logoUrl,
                  price: undefined // Цена будет получена динамически
                }
              });
            });
            
            setPositions(newPositions);
          }
        } else {
          setPositions([]);
        }
      } catch (err) {
        console.error('Error loading Meso positions:', err);
        setError('Failed to load positions');
        setPositions([]);
      } finally {
        setLoading(false);
      }
    }

    loadPositions();
  }, [walletAddress]);

  // Пересчитываем общую стоимость при изменении позиций или цен
  useEffect(() => {
    let totalValueSum = 0;
    
    positions.forEach(position => {
      const mesoToken = getMesoTokenByInner(position.inner); // исправлено: было position.balance
      if (mesoToken?.tokenAddress) {
        const amount = parseFloat(formatTokenAmount(position.balance, position.assetInfo.decimals));
        const price = getTokenPrice(mesoToken.tokenAddress);
        const value = price ? amount * parseFloat(price) : 0;
        
        if (position.type === 'deposit') {
          totalValueSum += value;
        } else {
          totalValueSum -= value; // Займы уменьшают общую стоимость
        }
      }
    });
    
    setTotalValue(Math.max(0, totalValueSum)); // Не показываем отрицательные значения
  }, [positions, tokenPrices]);

  // Вызываем колбэк при изменении общей суммы позиций
  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  // Если нет позиций, не отображаем блок
  if (positions.length === 0) {
    return null;
  }

  // Сортировка: сначала депозиты, потом займы, внутри каждой группы — по убыванию value
  const sortedPositions = [...positions].sort((a, b) => {
    if (a.type !== b.type) {
      // deposit выше debt
      return a.type === 'deposit' ? -1 : 1;
    }
    // Сортировка по value (стоимости позиции)
    const aAmount = parseFloat(formatTokenAmount(a.balance, a.assetInfo.decimals));
    const bAmount = parseFloat(formatTokenAmount(b.balance, b.assetInfo.decimals));
    
    const mesoTokenA = getMesoTokenByInner(a.inner); // исправлено: было a.balance
    const mesoTokenB = getMesoTokenByInner(b.inner); // исправлено: было b.balance
    const priceA = mesoTokenA?.tokenAddress ? getTokenPrice(mesoTokenA.tokenAddress) : '0';
    const priceB = mesoTokenB?.tokenAddress ? getTokenPrice(mesoTokenB.tokenAddress) : '0';
    
    const aValue = aAmount * parseFloat(priceA);
    const bValue = bAmount * parseFloat(priceB);
    return bValue - aValue;
  });

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('meso')}
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
            <CardTitle className="text-lg">Meso Finance</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg">${totalValue.toFixed(2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('meso') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded('meso') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {sortedPositions.map((position, index) => {
              const amount = formatTokenAmount(position.balance, position.assetInfo.decimals);
              const isDebt = position.type === 'debt';
              
              const mesoToken = getMesoTokenByInner(position.inner); // исправлено: было position.balance
              const price = mesoToken?.tokenAddress ? getTokenPrice(mesoToken.tokenAddress) : '0';
              const value = parseFloat(amount) * parseFloat(price);
              
              return (
                <div key={`${position.assetName}-${index}`} className="mb-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {position.assetInfo.logoUrl && (
                        <div className="w-6 h-6 relative">
                          <Image 
                            src={position.assetInfo.logoUrl} 
                            alt={position.assetInfo.symbol}
                            width={24}
                            height={24}
                            className="object-contain"
                          />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "text-sm font-medium",
                            isDebt && "text-red-500"
                          )}>{position.assetName}</div>
                          {isDebt && (
                            <div className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">
                              Borrow
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">${parseFloat(price).toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-sm font-medium",
                        isDebt && "text-red-500"
                      )}>${value.toFixed(2)}</div>
                      <div className={cn(
                        "text-xs",
                        isDebt ? "text-red-400" : "text-muted-foreground"
                      )}>{amount}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {protocol && <ManagePositionsButton protocol={protocol} />}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
} 