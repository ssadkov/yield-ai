import { useEffect, useState } from "react";
import { PositionCard } from "./PositionCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { ManagePositionsButton } from "../ManagePositionsButton";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { TokenPrice } from "@/lib/types/panora";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

interface Position {
  market: string;
  coin: string;
  supply: number;
  supplyApr: number;
  amount?: number;
  type?: string; // supply или borrow
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
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const { isExpanded, toggleSection } = useCollapsible();
  const pricesService = PanoraPricesService.getInstance();

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Echelon");

  // Функция для поиска информации о токене (без цены)
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
        usdPrice: null // Цена будет получена динамически
      };
    }
    
    return null;
  };

  // Получаем все уникальные адреса токенов из позиций
  const getAllTokenAddresses = () => {
    const addresses = new Set<string>();
    
    positions.forEach(position => {
      // Нормализуем адрес токена
      let cleanAddress = position.coin;
      if (cleanAddress.startsWith('@')) {
        cleanAddress = cleanAddress.slice(1);
      }
      if (!cleanAddress.startsWith('0x')) {
        cleanAddress = `0x${cleanAddress}`;
      }
      addresses.add(cleanAddress);
    });
    
    return Array.from(addresses);
  };

  // Получаем цену токена из кэша
  const getTokenPrice = (coinAddress: string): string => {
    let cleanAddress = coinAddress;
    if (cleanAddress.startsWith('@')) {
      cleanAddress = cleanAddress.slice(1);
    }
    if (!cleanAddress.startsWith('0x')) {
      cleanAddress = `0x${cleanAddress}`;
    }
    return tokenPrices[cleanAddress] || '0';
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
        const response = await fetch(`/api/protocols/echelon/userPositions?address=${walletAddress}`);
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Echelon API response:', data);
        
        if (data.success && Array.isArray(data.data)) {
          console.log('Setting positions:', data.data);
          setPositions(data.data);
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

  // Считаем общую сумму в долларах: supply плюсуем, borrow вычитаем
  const totalValue = positions.reduce((sum, position) => {
    const tokenInfo = getTokenInfo(position.coin);
    const rawAmount = position.supply ?? position.amount ?? 0;
    const amount = rawAmount / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
    const price = getTokenPrice(position.coin);
    const value = price ? amount * parseFloat(price) : 0;
    if (position.type === 'borrow') {
      return sum - value;
    }
    return sum + value;
  }, 0);

  // Сортируем позиции по значению от большего к меньшему
  const sortedPositions = [...positions].sort((a, b) => {
    const tokenInfoA = getTokenInfo(a.coin);
    const tokenInfoB = getTokenInfo(b.coin);
    const rawAmountA = a.supply ?? a.amount ?? 0;
    const rawAmountB = b.supply ?? b.amount ?? 0;
    const amountA = rawAmountA / (tokenInfoA?.decimals ? 10 ** tokenInfoA.decimals : 1e8);
    const amountB = rawAmountB / (tokenInfoB?.decimals ? 10 ** tokenInfoB.decimals : 1e8);
    const priceA = getTokenPrice(a.coin);
    const priceB = getTokenPrice(b.coin);
    const valueA = priceA ? amountA * parseFloat(priceA) : 0;
    const valueB = priceB ? amountB * parseFloat(priceB) : 0;
    return valueB - valueA;
  });

  // Вызываем колбэк при изменении общей суммы позиций
  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  // Если нет позиций, не отображаем блок
  if (positions.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('echelon')}
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
              isExpanded('echelon') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded('echelon') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {sortedPositions.map((position, index) => {
              const tokenInfo = getTokenInfo(position.coin);
              const rawAmount = position.supply ?? position.amount ?? 0;
              const amount = rawAmount / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
              const price = getTokenPrice(position.coin);
              const value = price ? (amount * parseFloat(price)).toFixed(2) : 'N/A';
              const isBorrow = position.type === 'borrow';
              return (
                <div key={`${position.coin}-${index}`} className={cn('mb-2', isBorrow && 'bg-red-50 rounded')}> 
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{tokenInfo?.symbol || position.coin.substring(0, 4).toUpperCase()}</span>
                          <span className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded',
                            isBorrow ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 'bg-green-500/10 text-green-600 border border-green-500/20')
                          }>
                            {isBorrow ? 'Borrow' : 'Supply'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${price ? parseFloat(price).toFixed(2) : 'N/A'}
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
            {/* Кнопка управления позициями, как у других протоколов */}
            {protocol && <ManagePositionsButton protocol={protocol} />}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
} 