import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

interface Position {
  market: string;
  coin: string;
  supply: number;
  supplyApr: number;
  borrow?: number;
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

interface EchelonReward {
  token: string;
  tokenType: string;
  amount: number;
  rawAmount: string;
  farmingId: string;
  stakeAmount: number;
}

export function PositionsList({ address, onPositionsValueChange }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [rewardsData, setRewardsData] = useState<EchelonReward[]>([]);
  const { isExpanded, toggleSection } = useCollapsible();
  const pricesService = PanoraPricesService.getInstance();

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Echelon");

  // Получаем цену токена из кэша
  const getTokenPrice = (coinAddress: string): string => {
    let cleanAddress = coinAddress;
    if (cleanAddress.startsWith('@')) {
      cleanAddress = cleanAddress.slice(1);
    }
    if (!cleanAddress.startsWith('0x')) {
      cleanAddress = `0x${cleanAddress}`;
    }
    const price = tokenPrices[cleanAddress] || '0';
    if (cleanAddress.toLowerCase().includes('stapt')) {
      console.log('[Echelon] getTokenPrice for stAPT:', cleanAddress, '=>', price);
    }
    return price;
  };

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

  // Функция для получения информации о токене наград
  const getRewardTokenInfoHelper = useCallback((tokenSymbol: string) => {
    console.log('[Echelon] getRewardTokenInfoHelper called for:', tokenSymbol);
    
    const token = (tokenList as any).data.data.find((token: any) => 
      token.symbol.toLowerCase() === tokenSymbol.toLowerCase() ||
      token.name.toLowerCase().includes(tokenSymbol.toLowerCase())
    );
    
    console.log('[Echelon] Found token:', token);
    
    if (!token) {
      console.log('[Echelon] Token not found for symbol:', tokenSymbol);
      return undefined;
    }
    
    const result = {
      address: token.tokenAddress,
      faAddress: token.faAddress,
      symbol: token.symbol,
      icon_uri: token.logoUrl,
      decimals: token.decimals,
      price: null // Цена будет получена динамически
    };
    
    console.log('[Echelon] Returning token info:', result);
    return result;
  }, []);

  // Функция для расчета стоимости наград
  const calculateRewardsValue = useCallback(() => {
    console.log('[Echelon] calculateRewardsValue called with rewardsData:', rewardsData);
    
    if (!rewardsData || rewardsData.length === 0) {
      console.log('[Echelon] No rewards data');
      return 0;
    }
    
    let totalValue = 0;
    
    rewardsData.forEach((reward) => {
      const tokenInfo = getRewardTokenInfoHelper(reward.token);
      console.log('[Echelon] Token info for reward:', reward.token, tokenInfo);
      if (!tokenInfo) {
        console.log('[Echelon] No token info for reward:', reward.token);
        return;
      }
      
      // Получаем цену динамически
      const price = getTokenPrice(tokenInfo.faAddress || tokenInfo.address || '');
      if (!price || price === '0') {
        console.log('[Echelon] No price for reward:', reward.token);
        return;
      }
      
      const value = reward.amount * parseFloat(price);
      totalValue += value;
      console.log('[Echelon] Reward calculated:', { token: reward.token, amount: reward.amount, value, totalValue });
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Echelon] Total rewards value:', totalValue, rewardsData);
    }
    return totalValue;
  }, [rewardsData, getRewardTokenInfoHelper, tokenPrices]);

  // Функция для загрузки наград
  const fetchRewards = useCallback(async () => {
    if (!walletAddress || walletAddress.length < 10) return;
    
    try {
      const response = await fetch(`/api/protocols/echelon/rewards?address=${walletAddress}`);
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        console.log('[Echelon] Rewards data received:', data.data);
        setRewardsData(data.data);
      } else {
        console.log('[Echelon] No rewards data or success=false:', data);
        setRewardsData([]);
      }
    } catch (error) {
      console.error('Error fetching Echelon rewards:', error);
      setRewardsData([]);
    }
  }, [walletAddress]);

  // Получаем все уникальные адреса токенов из позиций
  const getAllTokenAddresses = useCallback(() => {
    const addresses = new Set<string>();
    
    positions.forEach(position => {
      let cleanAddress = position.coin;
      if (cleanAddress.startsWith('@')) {
        cleanAddress = cleanAddress.slice(1);
      }
      if (!cleanAddress.startsWith('0x')) {
        cleanAddress = `0x${cleanAddress}`;
      }
      addresses.add(cleanAddress);
    });

    // Добавляем адреса токенов наград
    rewardsData.forEach((reward) => {
      const tokenInfo = getRewardTokenInfoHelper(reward.token);
      if (tokenInfo?.faAddress) {
        addresses.add(tokenInfo.faAddress);
      }
      if (tokenInfo?.address) {
        addresses.add(tokenInfo.address);
      }
    });

    const arr = Array.from(addresses);
    console.log('[Echelon] Token addresses for Panora:', arr);
    return arr;
  }, [positions, rewardsData, getRewardTokenInfoHelper]);

  // Получаем цены токенов через Panora API с дебаунсингом
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const addresses = getAllTokenAddresses();
      if (addresses.length === 0 || !walletAddress || walletAddress.length < 10) return;

      try {
        const response = await pricesService.getPrices(1, addresses);
        console.log('[Echelon] Panora API response:', response.data);
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
    }, 1000); // Дебаунсинг 1 секунда

    return () => clearTimeout(timeoutId);
  }, [getAllTokenAddresses, pricesService]);

  // Объединенный useEffect для загрузки позиций и наград с дебаунсингом
  useEffect(() => {
    if (!walletAddress || walletAddress.length < 10) {
      setPositions([]);
      setRewardsData([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Загружаем позиции
        const positionsResponse = await fetch(`/api/protocols/echelon/userPositions?address=${walletAddress}`);
        
        if (!positionsResponse.ok) {
          throw new Error(`Positions API returned status ${positionsResponse.status}`);
        }
        
        const positionsData = await positionsResponse.json();
        console.log('Echelon API response:', positionsData);
        
        if (positionsData.success && Array.isArray(positionsData.data)) {
          console.log('Setting positions:', positionsData.data);
          setPositions(positionsData.data);
        } else {
          console.log('No valid positions data');
          setPositions([]);
        }
        
        // Загружаем награды
        await fetchRewards();
      } catch (err) {
        console.error('Error loading Echelon data:', err);
        setError('Failed to load Echelon positions');
        setPositions([]);
        setRewardsData([]);
      } finally {
        setLoading(false);
      }
    }, 500); // Дебаунсинг 500мс

    return () => clearTimeout(timeoutId);
  }, [walletAddress, fetchRewards]);

  // Мемоизируем расчет общей суммы
  const totalValue = useMemo(() => {
    const positionsValue = positions.reduce((sum, position) => {
      const tokenInfo = getTokenInfo(position.coin);
      const isBorrow = position.type === 'borrow';
      const rawAmount = isBorrow ? (position.borrow ?? position.amount ?? 0) : (position.supply ?? position.amount ?? 0);
      const amount = rawAmount / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(position.coin);
      const value = price ? amount * parseFloat(price) : 0;
      if (isBorrow) {
        return sum - value;
      }
      return sum + value;
    }, 0);
    
    return positionsValue + calculateRewardsValue();
  }, [positions, tokenPrices, calculateRewardsValue]);

  // Мемоизируем сортировку позиций
  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const tokenInfoA = getTokenInfo(a.coin);
      const tokenInfoB = getTokenInfo(b.coin);
      const isBorrowA = a.type === 'borrow';
      const isBorrowB = b.type === 'borrow';
      const rawAmountA = isBorrowA ? (a.borrow ?? a.amount ?? 0) : (a.supply ?? a.amount ?? 0);
      const rawAmountB = isBorrowB ? (b.borrow ?? b.amount ?? 0) : (b.supply ?? b.amount ?? 0);
      const amountA = rawAmountA / (tokenInfoA?.decimals ? 10 ** tokenInfoA.decimals : 1e8);
      const amountB = rawAmountB / (tokenInfoB?.decimals ? 10 ** tokenInfoB.decimals : 1e8);
      const priceA = getTokenPrice(a.coin);
      const priceB = getTokenPrice(b.coin);
      const valueA = priceA ? amountA * parseFloat(priceA) : 0;
      const valueB = priceB ? amountB * parseFloat(priceB) : 0;
      return valueB - valueA;
    });
  }, [positions, tokenPrices]);

  // Вызываем колбэк при изменении общей суммы позиций
  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  // Если идет загрузка, не отображаем блок
  if (loading) {
    return null;
  }

  // Если есть ошибка, не отображаем блок
  if (error) {
    return null;
  }

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
              const isBorrow = position.type === 'borrow';
              const rawAmount = isBorrow ? (position.borrow ?? position.amount ?? 0) : (position.supply ?? position.amount ?? 0);
              const amount = rawAmount / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
              const price = getTokenPrice(position.coin);
              const value = price ? (amount * parseFloat(price)).toFixed(2) : 'N/A';
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
            
            {/* Total Rewards */}
            {calculateRewardsValue() > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 cursor-help">
                      <span className="text-sm text-muted-foreground">💰 Total rewards:</span>
                      <span className="text-sm font-medium">${calculateRewardsValue().toFixed(2)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-black text-white border-gray-700 max-w-xs">
                    <div className="text-xs font-semibold mb-1">Rewards breakdown:</div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                             {rewardsData.map((reward, idx) => {
                         const tokenInfo = getRewardTokenInfoHelper(reward.token);
                         if (!tokenInfo) return null;
                         const price = getTokenPrice(tokenInfo.faAddress || tokenInfo.address || '');
                         const value = price && price !== '0' ? (reward.amount * parseFloat(price)).toFixed(2) : 'N/A';
                         return (
                           <div key={idx} className="flex items-center gap-2">
                             {tokenInfo.icon_uri && (
                               <img src={tokenInfo.icon_uri} alt={tokenInfo.symbol} className="w-3 h-3 rounded-full" />
                             )}
                             <span>{tokenInfo.symbol}</span>
                             <span>{reward.amount.toFixed(6)}</span>
                             <span className="text-gray-300">${value}</span>
                           </div>
                         );
                       })}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Кнопка управления позициями, как у других протоколов */}
            {protocol && <ManagePositionsButton protocol={protocol} />}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
} 