'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { TokenPrice } from "@/lib/types/panora";
import { useWithdraw } from "@/lib/hooks/useWithdraw";
import { WithdrawModal } from "@/components/ui/withdraw-modal";

interface AavePosition {
  underlying_asset: string;
  symbol: string;
  name: string;
  decimals: number;
  deposit_amount: number;
  deposit_value_usd: number;
  borrow_amount: number;
  borrow_value_usd: number;
  usage_as_collateral_enabled: boolean;
  liquidity_index: string;
  variable_borrow_index: string;
}

interface AavePool {
  asset: string;
  provider: string;
  totalAPY: number;
  depositApy: number;
  borrowAPY: number;
  token: string;
  protocol: string;
  poolType: string;
  liquidityRate: number;
  variableBorrowRate: number;
  liquidityIndex: string;
  variableBorrowIndex: string;
  priceInMarketRef: string;
  decimals: number;
}

interface TokenInfo {
  address: string;
  symbol: string;
  logoUrl: string;
  decimals: number;
  usdPrice: string;
}

export function AavePositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<AavePosition[]>([]);
  const [loading, setLoading] = useState(true); // Начинаем с true
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false); // Флаг попытки загрузки
  const [totalValue, setTotalValue] = useState<number>(0);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [apyData, setApyData] = useState<Record<string, AavePool>>({});
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<AavePosition | null>(null);
  const { withdraw, isLoading: isWithdrawing } = useWithdraw();
  const pricesService = PanoraPricesService.getInstance();

  // Функция для получения информации о токене
  const getTokenInfo = (coinAddress: string): TokenInfo | undefined => {
    const token = (tokenList as any).data.data.find(
      (t: any) => t.faAddress === coinAddress || t.tokenAddress === coinAddress
    );
    
    if (!token) return undefined;
    
    return {
      address: token.tokenAddress,
      symbol: token.symbol,
      logoUrl: token.logoUrl,
      decimals: token.decimals,
      usdPrice: getTokenPrice(coinAddress)
    };
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

  // Получаем все уникальные адреса токенов из позиций
  const getAllTokenAddresses = useCallback(() => {
    const addresses = new Set<string>();
    
    positions.forEach(position => {
      if (position.underlying_asset) {
        addresses.add(position.underlying_asset);
      }
    });

    return Array.from(addresses);
  }, [positions]);

  // Загружаем APR данные из pools API
  useEffect(() => {
    fetch('/api/protocols/aave/pools')
      .then(res => res.json())
      .then(data => {
        console.log('AavePositions - APR data loaded:', data);
        if (data.success && data.data) {
          // Создаем маппинг token -> APR данные
          const apyMapping: Record<string, AavePool> = {};
          data.data.forEach((pool: AavePool) => {
            apyMapping[pool.token] = pool;
          });
          setApyData(apyMapping);
          console.log('AavePositions - APR mapping created:', apyMapping);
        }
      })
      .catch(error => {
        console.error('AavePositions - APR data load error:', error);
      });
  }, []);

  // Получаем цены токенов через Panora API с дебаунсингом
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const addresses = getAllTokenAddresses();
      if (addresses.length === 0 || !account?.address) return;

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
    }, 1000); // Дебаунсинг 1 секунда

    return () => clearTimeout(timeoutId);
  }, [getAllTokenAddresses, pricesService, account?.address]);

  // Загружаем позиции
  useEffect(() => {
    if (!account?.address) {
      setPositions([]);
      setLoading(false);
      setHasAttemptedLoad(true);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setError(null);
      
      try {
        const response = await fetch(`/api/protocols/aave/positions?address=${account.address}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch positions: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success && data.data) {
          setPositions(data.data);
        } else {
          setPositions([]);
        }
      } catch (err) {
        console.error('Error fetching Aave positions:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch positions');
        setPositions([]);
      } finally {
        setLoading(false);
        setHasAttemptedLoad(true);
      }
    }, 500); // Дебаунсинг 500мс

    return () => clearTimeout(timeoutId);
  }, [account?.address]);

  // Подписка на глобальное событие обновления позиций
  useEffect(() => {
    const handleRefresh = (event: CustomEvent) => {
      if (event.detail?.protocol === 'aave') {
        const incoming = event.detail?.data;
        if (incoming && Array.isArray(incoming)) {
          setPositions(incoming);
        } else {
          // Перезагружаем из API
          if (account?.address) {
            setLoading(true);
            fetch(`/api/protocols/aave/positions?address=${account.address}`)
              .then(res => res.json())
              .then(data => {
                if (data.success && data.data) {
                  setPositions(data.data);
                }
              })
              .catch(console.error)
              .finally(() => {
                setLoading(false);
                setHasAttemptedLoad(true);
              });
          }
        }
      }
    };

    window.addEventListener('refreshPositions', handleRefresh as unknown as EventListener);
    return () => {
      window.removeEventListener('refreshPositions', handleRefresh as unknown as EventListener);
    };
  }, [account?.address]);

  // Получить APR для позиции
  const getApyForPosition = (position: AavePosition, type: 'deposit' | 'borrow'): number | null => {
    const pool = apyData[position.underlying_asset];
    if (!pool) return null;
    
    if (type === 'deposit') {
      return pool.depositApy / 100; // Конвертируем из процентов в десятичную дробь
    } else {
      return pool.borrowAPY / 100; // Конвертируем из процентов в десятичную дробь
    }
  };

  // Обработчик открытия модального окна withdraw
  const handleWithdrawClick = (position: AavePosition) => {
    setSelectedPosition(position);
    setShowWithdrawModal(true);
  };

  // Обработчик подтверждения withdraw
  const handleWithdrawConfirm = async (amount: bigint) => {
    if (!selectedPosition) return;
    
    try {
      console.log('Withdraw confirm - selectedPosition:', selectedPosition);
      console.log('Withdraw confirm - amount:', amount.toString());
      console.log('Withdraw confirm - token:', selectedPosition.underlying_asset);
      
      // AAVE проще - используем underlying_asset напрямую
      const tokenAddress = selectedPosition.underlying_asset;
      
      // Вызываем withdraw через useWithdraw hook
      await withdraw('aave', tokenAddress, amount, tokenAddress);
      
      // Закрываем модал и обновляем состояние
      setShowWithdrawModal(false);
      setSelectedPosition(null);
      
    } catch (error) {
      console.error('Withdraw failed:', error);
    }
  };

  // Создаем плоский список позиций для отображения
  const flattenedPositions = positions.flatMap(position => {
    const result = [];
    
    // Добавляем deposit позицию если есть
    if (position.deposit_amount > 0) {
      result.push({
        ...position,
        type: 'deposit' as const,
        amount: position.deposit_amount,
        value_usd: position.deposit_value_usd
      });
    }
    
    // Добавляем borrow позицию если есть
    if (position.borrow_amount > 0) {
      result.push({
        ...position,
        type: 'borrow' as const,
        amount: position.borrow_amount,
        value_usd: position.borrow_value_usd
      });
    }
    
    return result;
  });

  // Сортируем позиции по значению от большего к меньшему
  const sortedPositions = [...flattenedPositions].sort((a, b) => {
    // borrow всегда ниже deposit
    if (a.type !== b.type) {
      return a.type === 'borrow' ? 1 : -1;
    }
    return b.value_usd - a.value_usd;
  });

  // Считаем общую сумму: deposits плюсуем, borrows вычитаем
  useEffect(() => {
    const total = sortedPositions.reduce((sum, position) => {
      if (position.type === 'borrow') {
        return sum - position.value_usd;
      }
      return sum + position.value_usd;
    }, 0);
    
    setTotalValue(total);
  }, [sortedPositions]);

  // Показываем loading если загружаемся или если нет кошелька и еще не пытались загрузить
  if (loading || (!account?.address && !hasAttemptedLoad)) {
    return <div>Loading Aave positions...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <Button 
          onClick={() => window.open('https://aptos.aave.com/', '_blank')}
          variant="outline"
        >
          View on Aave
        </Button>
      </div>
    );
  }

  // Показываем "No positions" только если не загружаемся, нет ошибок и уже пытались загрузить
  if (!loading && !error && hasAttemptedLoad && positions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No Aave positions found
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 text-base">
      <ScrollArea className="h-[60vh] sm:h-auto">
        {sortedPositions.map((position, index) => {
          const tokenInfo = getTokenInfo(position.underlying_asset);
          const amount = position.amount;
          const price = getTokenPrice(position.underlying_asset);
          const value = position.value_usd.toFixed(2);
          const apy = getApyForPosition(position, position.type);
          const isBorrow = position.type === 'borrow';
          
          return (
            <div 
              key={`${position.underlying_asset}-${position.type}-${index}`} 
              className={cn(
                'p-3 sm:p-4 border-b last:border-b-0 transition-colors',
                isBorrow && 'bg-red-50'
              )}
            >
              {/* Мобильная компоновка - вертикальная */}
              <div className="block sm:hidden space-y-3">
                {/* Верхняя строка - токен и бейджи */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {tokenInfo?.logoUrl && (
                      <div className="w-8 h-8 relative">
                        <Image 
                          src={tokenInfo.logoUrl} 
                          alt={tokenInfo.symbol}
                          width={32}
                          height={32}
                          className="object-contain"
                        />
                      </div>
                    )}
                    <div>
                      <div className="text-base font-semibold">{tokenInfo?.symbol || position.symbol}</div>
                      <div className="text-sm text-muted-foreground">
                        ${price ? parseFloat(price).toFixed(2) : 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">${value}</div>
                    <div className="text-sm text-muted-foreground">
                      {amount.toFixed(4)}
                    </div>
                  </div>
                </div>
                
                {/* Средняя строка - бейджи */}
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      isBorrow
                        ? 'bg-red-500/10 text-red-600 border-red-500/20'
                        : 'bg-green-500/10 text-green-600 border-green-500/20',
                      'text-xs font-normal px-2 py-1 h-6'
                    )}
                  >
                    {isBorrow ? 'Borrow' : 'Supply'}
                  </Badge>
                  <Badge variant="outline" className={cn(
                    isBorrow
                      ? 'bg-red-500/10 text-red-600 border-red-500/20'
                      : 'bg-green-500/10 text-green-600 border-green-500/20',
                    'text-xs font-normal px-2 py-1 h-6'
                  )}>
                    APR: {apy !== null ? (apy * 100).toFixed(2) + '%' : 'N/A'}
                  </Badge>
                  {position.usage_as_collateral_enabled && position.type === 'deposit' && (
                    <Badge 
                      variant="outline" 
                      className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-2 py-1 h-6"
                    >
                      Collateral
                    </Badge>
                  )}
                </div>
                
                {/* Нижняя строка - кнопки действий */}
                {!isBorrow && position.deposit_amount > 0 && (
                  <div className="pt-2">
                    <Button
                      onClick={() => handleWithdrawClick(position)}
                      disabled={isWithdrawing}
                      size="sm"
                      variant="outline"
                      className="w-full h-10"
                    >
                      {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Десктопная компоновка - горизонтальная */}
              <div className="hidden sm:flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {tokenInfo?.logoUrl && (
                    <div className="w-8 h-8 relative">
                      <Image 
                        src={tokenInfo.logoUrl} 
                        alt={tokenInfo.symbol}
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg">{tokenInfo?.symbol || position.symbol}</div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          isBorrow
                            ? 'bg-red-500/10 text-red-600 border-red-500/20'
                            : 'bg-green-500/10 text-green-600 border-green-500/20',
                          'text-xs font-normal px-2 py-0.5 h-5'
                        )}
                      >
                        {isBorrow ? 'Borrow' : 'Supply'}
                      </Badge>
                      {position.usage_as_collateral_enabled && position.type === 'deposit' && (
                        <Badge 
                          variant="outline" 
                          className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-2 py-0.5 h-5"
                        >
                          Collateral
                        </Badge>
                      )}
                    </div>
                    <div className="text-base text-muted-foreground mt-0.5">
                      ${price ? parseFloat(price).toFixed(2) : 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={cn(
                      isBorrow
                        ? 'bg-red-500/10 text-red-600 border-red-500/20'
                        : 'bg-green-500/10 text-green-600 border-green-500/20',
                      'text-xs font-normal px-2 py-0.5 h-5')}
                    >
                      APR: {apy !== null ? (apy * 100).toFixed(2) + '%' : 'N/A'}
                    </Badge>
                    <div className="text-lg font-bold">${value}</div>
                  </div>
                  <div className="text-base text-muted-foreground font-semibold">
                    {amount.toFixed(4)}
                  </div>
                  {/* Кнопки действий для deposit позиций */}
                  {!isBorrow && position.deposit_amount > 0 && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        onClick={() => handleWithdrawClick(position)}
                        disabled={isWithdrawing}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </ScrollArea>
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 sm:pt-6 pb-4 sm:pb-6 gap-2">
        <span className="text-lg sm:text-xl">Total assets in Aave:</span>
        <div className="text-right">
          <span className="text-lg sm:text-xl text-primary font-bold">${totalValue.toFixed(2)}</span>
        </div>
      </div>

      {/* Withdraw Modal */}
      {selectedPosition && (
        <WithdrawModal
          isOpen={showWithdrawModal}
          onClose={() => {
            setShowWithdrawModal(false);
            setSelectedPosition(null);
          }}
          onConfirm={handleWithdrawConfirm}
          position={{ 
            coin: selectedPosition.underlying_asset, 
            supply: String(selectedPosition.deposit_amount) 
          }}
          tokenInfo={getTokenInfo(selectedPosition.underlying_asset)}
          isLoading={isWithdrawing}
          userAddress={account?.address?.toString()}
        />
      )}
    </div>
  );
}
