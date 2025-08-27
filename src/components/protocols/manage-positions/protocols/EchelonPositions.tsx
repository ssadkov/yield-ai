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
import { useWithdraw } from "@/lib/hooks/useWithdraw";
import { WithdrawModal } from "@/components/ui/withdraw-modal";
import echelonMarkets from "@/lib/data/echelonMarkets.json";
import { useDragDrop } from "@/contexts/DragDropContext";
import { PositionDragData } from "@/types/dragDrop";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { TokenPrice } from "@/lib/types/panora";
import { useClaimRewards } from "@/lib/hooks/useClaimRewards";
import { ClaimAllRewardsEchelonModal } from "@/components/ui/claim-all-rewards-echelon-modal";
import { DepositModal } from "@/components/ui/deposit-modal";
import { ProtocolKey } from "@/lib/transactions/types";

interface Position {
  coin: string;
  amount: number | string;
  market?: string;
  type?: string; // supply или borrow
}

interface EchelonReward {
  token: string;
  tokenType: string;
  rewardName?: string;
  amount: number;
  rawAmount: string;
  farmingId: string;
  stakeAmount: number;
}

export function EchelonPositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showClaimAllModal, setShowClaimAllModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [rewardsData, setRewardsData] = useState<EchelonReward[]>([]);
  const [apyData, setApyData] = useState<Record<string, any>>({});
  const { withdraw, isLoading: isWithdrawing } = useWithdraw();
  const { claimRewards, isLoading: isClaiming } = useClaimRewards();
  const { startDrag, endDrag, state, closePositionModal, closeAllModals, setPositionConfirmHandler } = useDragDrop();
  const isModalOpenRef = useRef(false);
  const pricesService = PanoraPricesService.getInstance();

  // Функция для получения информации о токене наград
  const getRewardTokenInfoHelper = (tokenName: string) => {
    const token = (tokenList as any).data.data.find(
      (t: any) => 
        t.symbol.toLowerCase() === tokenName.toLowerCase() ||
        t.name.toLowerCase().includes(tokenName.toLowerCase())
    );
    
    if (!token) return undefined;
    
    return {
      address: token.tokenAddress,
      faAddress: token.faAddress,
      symbol: token.symbol,
      icon_uri: token.logoUrl,
      decimals: token.decimals,
      usdPrice: getTokenPrice(token.faAddress || token.tokenAddress || '')
    };
  };

  // Получаем все уникальные адреса токенов из позиций и наград
  const getAllTokenAddresses = useCallback(() => {
    const addresses = new Set<string>();
    
    // Добавляем адреса токенов позиций
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

    return Array.from(addresses);
  }, [positions, rewardsData, getRewardTokenInfoHelper]);

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



  // Загрузка rewards
  const fetchRewards = useCallback(async () => {
    if (!account?.address) return;
    
    try {
      const response = await fetch(`/api/protocols/echelon/rewards?address=${account.address}`);
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setRewardsData(data.data);
      } else {
        setRewardsData([]);
      }
    } catch (error) {
      console.error('Error loading rewards:', error);
      setRewardsData([]);
    }
  }, [account?.address]);

  // Унифицированный рефрешер данных (позиции + награды)
  const reloadData = useCallback(async (positionsDataFromEvent?: any[]) => {
    // Если пришли позиции из события, устанавливаем их и обновляем награды
    if (positionsDataFromEvent && Array.isArray(positionsDataFromEvent)) {
      setPositions(positionsDataFromEvent);
      try {
        await fetchRewards();
      } catch {
        // ignore
      }
      return;
    }

    if (!account?.address) return;
    try {
      setLoading(true);
      setError(null);
      const positionsResponse = await fetch(`/api/protocols/echelon/userPositions?address=${account.address}`);
      if (!positionsResponse.ok) {
        throw new Error(`Positions API returned status ${positionsResponse.status}`);
      }
      const positionsJson = await positionsResponse.json();
      if (positionsJson.success && Array.isArray(positionsJson.data)) {
        setPositions(positionsJson.data);
      } else {
        setPositions([]);
      }
      await fetchRewards();
    } catch (err) {
      console.error('[EchelonPositions] Error reloading data:', err);
      setError('Failed to load Echelon positions');
    } finally {
      setLoading(false);
    }
  }, [account?.address, fetchRewards]);

  // Расчет стоимости rewards
  const calculateRewardsValue = useCallback(() => {
    return rewardsData.reduce((sum, reward) => {
      const tokenInfo = getRewardTokenInfoHelper(reward.token);
      if (!tokenInfo) return sum;
      
      const price = getTokenPrice(tokenInfo.faAddress || tokenInfo.address || '');
      const value = price && price !== '0' ? reward.amount * parseFloat(price) : 0;
      
      return sum + value;
    }, 0);
  }, [rewardsData, tokenPrices]);

  // Claim rewards
  const handleClaimRewards = async () => {
    if (!account?.address || rewardsData.length === 0) return;
    
    try {
      // Для Echelon нужно вызывать claim для каждого reward отдельно
      for (const reward of rewardsData) {
        await claimRewards('echelon', [reward.farmingId], [reward.tokenType]);
      }
      
      // Обновить данные
      await fetchRewards();
    } catch (error) {
      console.error('Error claiming rewards:', error);
    }
  };

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

      // Загружаем APR данные из того же источника, что и Pro вкладка
  useEffect(() => {
    fetch('/api/protocols/echelon/v2/pools')
      .then(res => res.json())
      .then(data => {
        console.log('EchelonPositions - APR data loaded:', data);
        if (data.success && data.data) {
                      // Создаем двойной маппинг: по asset (символ) и по token (адрес) для совместимости
          const apyMapping: Record<string, any> = {};
          data.data.forEach((pool: any) => {
            // Используем asset (символ токена) как основной ключ
            const assetKey = pool.asset;
            const tokenKey = pool.token;
            
            if (assetKey) {
              const poolData = {
                supplyAPY: pool.depositApy,
                borrowAPY: pool.borrowAPY,
                supplyRewardsApr: pool.supplyRewardsApr,
                borrowRewardsApr: pool.borrowRewardsApr,
                marketAddress: pool.marketAddress,
                asset: pool.asset,
                poolType: pool.poolType,
                // Добавляем информацию о том, какие типы операций доступны
                hasSupply: pool.depositApy > 0,
                hasBorrow: pool.borrowAPY > 0,
                hasStaking: pool.stakingApr > 0,
                // Добавляем разбивку APR для tooltip
                lendingApr: pool.lendingApr || 0,
                stakingAprOnly: pool.stakingAprOnly || 0,
                totalSupplyApr: pool.totalSupplyApr || pool.depositApy || 0
              };
              
              // Сохраняем по символу токена
              apyMapping[assetKey] = poolData;
              
              // Также сохраняем по адресу токена для совместимости с существующим кодом
              if (tokenKey) {
                apyMapping[tokenKey] = poolData;
              }
              
              // Специальная обработка для APT токена - добавляем маппинги для альтернативных адресов
              if (assetKey === 'APT' && pool.aptAlternativeAddresses) {
                pool.aptAlternativeAddresses.forEach((altAddress: string) => {
                  apyMapping[altAddress] = poolData;
                });
              }
            }
          });
                     setApyData(apyMapping);
           console.log('EchelonPositions - APR mapping created:', apyMapping);
           console.log('EchelonPositions - APR mapping keys:', Object.keys(apyMapping));
           
           // Специальная проверка для APT
           if (apyMapping['APT']) {
             console.log('EchelonPositions - APT pool data found:', apyMapping['APT']);
           }
           if (apyMapping['0x1::aptos_coin::AptosCoin']) {
             console.log('EchelonPositions - APT by address found:', apyMapping['0x1::aptos_coin::AptosCoin']);
           }
           if (apyMapping['0xa']) {
             console.log('EchelonPositions - APT by short address found:', apyMapping['0xa']);
           }
           if (apyMapping['0x0a']) {
             console.log('EchelonPositions - APT by padded address found:', apyMapping['0x0a']);
           }
        }
      })
              .catch(error => {
          console.error('EchelonPositions - APR data load error:', error);
        console.log('Using fallback APR data');
        // Fallback на старые данные
        // setMarketData(echelonMarkets.markets); // This line is removed
      });
  }, []);

  // Объединенный useEffect для загрузки позиций и наград с дебаунсингом
  useEffect(() => {
    if (!account?.address) {
      setPositions([]);
      setRewardsData([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Загружаем позиции
        const positionsResponse = await fetch(`/api/protocols/echelon/userPositions?address=${account.address}`);
        
        if (!positionsResponse.ok) {
          throw new Error(`Positions API returned status ${positionsResponse.status}`);
        }
        
        const positionsData = await positionsResponse.json();
        
        if (positionsData.success && Array.isArray(positionsData.data)) {
          setPositions(positionsData.data);
        } else {
          setPositions([]);
        }
        
        // Загружаем награды
        await fetchRewards();
      } catch (err) {
        console.error('[Managing Positions] Error loading data:', err);
        setError('Failed to load Echelon positions');
        setPositions([]);
        setRewardsData([]);
      } finally {
        setLoading(false);
      }
    }, 500); // Дебаунсинг 500мс

    return () => clearTimeout(timeoutId);
  }, [account?.address, fetchRewards]);

  // Подписка на глобальное событие обновления позиций
  useEffect(() => {
    const handleRefresh = (event: CustomEvent) => {
      if (event.detail?.protocol === 'echelon') {
        const incoming = event.detail?.data;
        if (incoming && Array.isArray(incoming)) {
          // При ручном Refresh из ManagePositions приходят новые позиции
          reloadData(incoming);
        } else {
          // После Withdraw/Claim данных нет — перезагружаем из API
          reloadData();
        }
      }
    };

    window.addEventListener('refreshPositions', handleRefresh as unknown as EventListener);
    return () => {
      window.removeEventListener('refreshPositions', handleRefresh as unknown as EventListener);
    };
  }, [reloadData]);

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
      usdPrice: getTokenPrice(coinAddress) // Используем динамическую цену
    };
  };

      // Получить APR для позиции (обновленная функция)
  const getApyForPosition = (position: any) => {
    // Ищем данные в APR маппинге по адресу токена
    let poolData = apyData[position.coin];
    
    // Если не найдено по адресу, попробуем найти по символу токена
    if (!poolData && position.coin) {
      const tokenInfo = getTokenInfo(position.coin);
      if (tokenInfo?.symbol) {
        poolData = apyData[tokenInfo.symbol];
        console.log(`Trying to find APR data by symbol ${tokenInfo.symbol} for ${position.coin}`);
      }
    }
    
    if (poolData) {
      console.log(`Found APR data for ${position.coin}:`, poolData);
      if (position.type === 'supply') {
        const apy = poolData.supplyAPY / 100; // Конвертируем из процентов в десятичную форму
        console.log(`Supply APR for ${position.coin}: ${apy * 100}%`);
        return apy;
      } else if (position.type === 'borrow') {
        const apy = poolData.borrowAPY / 100;
        console.log(`Borrow APR for ${position.coin}: ${apy * 100}%`);
        return apy;
      }
    }
    
    console.log(`No APR data found for ${position.coin}`);
    return null;
  };

  // Сортируем позиции по значению от большего к меньшему
  const sortedPositions = [...positions].sort((a, b) => {
    const tokenInfoA = getTokenInfo(a.coin);
    const tokenInfoB = getTokenInfo(b.coin);
    const amountA = parseFloat(String(a.amount)) / (tokenInfoA?.decimals ? 10 ** tokenInfoA.decimals : 1e8);
    const amountB = parseFloat(String(b.amount)) / (tokenInfoB?.decimals ? 10 ** tokenInfoB.decimals : 1e8);
    const priceA = getTokenPrice(a.coin);
    const priceB = getTokenPrice(b.coin);
    const valueA = priceA ? amountA * parseFloat(priceA) : 0;
    const valueB = priceB ? amountB * parseFloat(priceB) : 0;
    // borrow всегда ниже supply
    if ((a.type === 'borrow') !== (b.type === 'borrow')) {
      return a.type === 'borrow' ? 1 : -1;
    }
    return valueB - valueA;
  });

  // Считаем общую сумму: supply плюсуем, borrow вычитаем, rewards плюсуем
  useEffect(() => {
    const positionsValue = sortedPositions.reduce((sum, position) => {
      const tokenInfo = getTokenInfo(position.coin);
      const amount = parseFloat(String(position.amount)) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(position.coin);
      const value = price ? amount * parseFloat(price) : 0;
      if (position.type === 'borrow') {
        return sum - value;
      }
      return sum + value;
    }, 0);
    
    const rewardsValue = calculateRewardsValue();
    setTotalValue(positionsValue + rewardsValue);
  }, [sortedPositions, tokenPrices, calculateRewardsValue]);

  // Обработчик открытия модального окна withdraw
  const handleWithdrawClick = (position: Position) => {
    setSelectedPosition(position);
    setShowWithdrawModal(true);
  };

  // Обработчик открытия модального окна deposit
  const handleDepositClick = (position: Position) => {
    console.log('Deposit click - position:', position);
    console.log('Deposit click - apyData keys:', Object.keys(apyData));
    console.log('Deposit click - apyData for this coin:', apyData[position.coin]);
    
         // Попробуем найти market address для депозита
     let marketAddress = position.market;
     if (!marketAddress) {
       let poolData = apyData[position.coin];
       

       
       if (!poolData) {
         const tokenInfo = getTokenInfo(position.coin);
         if (tokenInfo?.symbol) {
           poolData = apyData[tokenInfo.symbol];
           console.log(`Found pool data by symbol ${tokenInfo.symbol}:`, poolData);
         }
       }
       if (poolData?.marketAddress) {
         marketAddress = poolData.marketAddress;
         console.log('Found market address for deposit:', marketAddress);
       }
     }
    
    console.log('Deposit click - getApyForPosition result:', getApyForPosition(position));
    console.log('Deposit click - market address:', marketAddress);
    setSelectedPosition(position);
    setShowDepositModal(true);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, position: Position) => {
    const tokenInfo = getTokenInfo(position.coin);
    // const market = marketData.find((m: any) => m.coin === position.coin); // This line is removed
    
    const dragData: PositionDragData = {
      type: 'position',
      positionId: position.coin,
      asset: position.coin,
      amount: String(position.amount),
      positionType: 'lend',
      protocol: 'Echelon',
      // market: market?.market, // This line is removed
      tokenInfo: tokenInfo ? {
        symbol: tokenInfo.symbol,
        logoUrl: tokenInfo.logoUrl,
        decimals: tokenInfo.decimals,
        usdPrice: tokenInfo.usdPrice,
      } : undefined,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    
    startDrag(dragData);
  };

  const handleDragEnd = () => {
    endDrag();
  };

  // Обработчик подтверждения withdraw
  const handleWithdrawConfirm = async (amount: bigint) => {
    if (!selectedPosition) return;
    
    try {
      console.log('Withdraw confirm - selectedPosition:', selectedPosition);
      // console.log('Withdraw confirm - marketData:', marketData); // This line is removed
      
      // Если market address нет в позиции, получаем его из API
      let marketAddress = selectedPosition.market;
      console.log('Withdraw confirm - initial marketAddress:', marketAddress);
      
      if (!marketAddress) {
        console.log('Withdraw confirm - searching for market by coin:', selectedPosition.coin);
        // const market = marketData.find((m: any) => m.coin === selectedPosition.coin); // This line is removed
        // console.log('Withdraw confirm - found market:', market); // This line is removed
        // marketAddress = market?.market; // This line is removed
        // console.log('Withdraw confirm - marketAddress from marketData:', marketAddress); // This line is removed
      }
      
                    // Если все еще нет market address, попробуем получить его из apyData
        if (!marketAddress) {
          console.log('Withdraw confirm - trying to get market address from apyData');
          let poolData = apyData[selectedPosition.coin];
          

          
          // Если не найдено по адресу, попробуем найти по символу токена
          if (!poolData) {
            const tokenInfo = getTokenInfo(selectedPosition.coin);
            if (tokenInfo?.symbol) {
              poolData = apyData[tokenInfo.symbol];
              console.log(`Trying to find market address by symbol ${tokenInfo.symbol} for ${selectedPosition.coin}`);
            }
          }
          
          if (poolData?.marketAddress) {
            marketAddress = poolData.marketAddress;
            console.log('Withdraw confirm - marketAddress from apyData:', marketAddress);
          }
        }
      
             // Если все еще нет market address, используем локальные данные
       if (!marketAddress) {
         console.log('Withdraw confirm - trying to get market address from local data');
         let localMarket = echelonMarkets.markets.find((m: any) => m.coin === selectedPosition.coin);
         

         
         marketAddress = localMarket?.market;
         console.log('Withdraw confirm - marketAddress from local data:', marketAddress);
       }
      
      if (!marketAddress) {
        console.error('Withdraw confirm - no market address found');
        console.error('Withdraw confirm - selectedPosition.coin:', selectedPosition.coin);
        // console.error('Withdraw confirm - marketData length:', marketData.length); // This line is removed
        // console.error('Withdraw confirm - marketData coins:', marketData.map((m: any) => m.coin)); // This line is removed
        throw new Error('Market address not found for this token');
      }
      
      console.log('Withdraw confirm - final marketAddress:', marketAddress);
      console.log('Withdraw confirm - amount:', amount.toString());
      console.log('Withdraw confirm - coin:', selectedPosition.coin);
      
      await withdraw('echelon', marketAddress, amount, selectedPosition.coin);
      setShowWithdrawModal(false);
      setSelectedPosition(null);
      isModalOpenRef.current = false;
      closePositionModal(selectedPosition.coin);
    } catch (error) {
      console.error('Withdraw failed:', error);
    }
  };

  if (loading) {
    return <div>Loading positions...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  console.log('EchelonPositions - render - positions length:', positions.length);
  console.log('EchelonPositions - render - positions:', positions);
  console.log('EchelonPositions - render - sortedPositions length:', sortedPositions.length);

  if (positions.length === 0) {
    console.log('EchelonPositions - render - returning null because positions.length === 0');
    return null;
  }

  return (
    <div className="space-y-4 text-base">
      <ScrollArea>
        {sortedPositions.map((position, index) => {
          const tokenInfo = getTokenInfo(position.coin);
          const rawAmount = typeof position.amount === 'number' ? position.amount : parseFloat(position.amount);
          const amount = !isNaN(rawAmount) && tokenInfo?.decimals ? rawAmount / 10 ** tokenInfo.decimals : 0;
          const price = getTokenPrice(position.coin);
          const value = price ? (amount * parseFloat(price)).toFixed(2) : 'N/A';
          const apy = getApyForPosition(position);
          const isBorrow = position.type === 'borrow';
          
          return (
            <div 
              key={`${position.coin}-${index}`} 
              className={cn(
                'p-4 border-b last:border-b-0 transition-colors',
                isBorrow && 'bg-red-50'
              )}
              draggable={false}
            >
              <div className="flex justify-between items-center">
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
                      <div className="text-lg">{tokenInfo?.symbol || position.coin.substring(0, 4).toUpperCase()}</div>
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
                      {apy !== null ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                APR: {(apy * 100).toFixed(2)}%
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-black text-white border-gray-700 max-w-xs">
                              <div className="text-xs font-semibold mb-1">APR Breakdown:</div>
                              <div className="space-y-1">
                                {!isBorrow && apyData[position.coin]?.lendingApr > 0 && (
                                  <div className="flex justify-between">
                                    <span>Lending APR:</span>
                                    <span className="text-green-400">{apyData[position.coin].lendingApr.toFixed(2)}%</span>
                                  </div>
                                )}
                                {!isBorrow && apyData[position.coin]?.stakingAprOnly > 0 && (
                                  <div className="flex justify-between">
                                    <span>Staking APR:</span>
                                    <span className="text-blue-400">{apyData[position.coin].stakingAprOnly.toFixed(2)}%</span>
                                  </div>
                                )}
                                {!isBorrow && apyData[position.coin]?.supplyRewardsApr > 0 && (
                                  <div className="flex justify-between">
                                    <span>Rewards APR:</span>
                                    <span className="text-yellow-400">{apyData[position.coin].supplyRewardsApr.toFixed(2)}%</span>
                                  </div>
                                )}
                                <div className="border-t border-gray-600 pt-1 mt-1">
                                  <div className="flex justify-between font-semibold">
                                    <span>Total:</span>
                                    <span className="text-white">{(apy * 100).toFixed(2)}%</span>
                                  </div>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        'APR: N/A'
                      )}
                    </Badge>
                    <div className="text-lg font-bold">${value}</div>
                  </div>
                  <div className="text-base text-muted-foreground font-semibold">{amount.toFixed(4)}</div>
                  <div className="flex flex-col gap-1 mt-2">
                    {!isBorrow && (
                      <div className="flex gap-2">
                        <button
                          className={cn(
                            'px-3 py-1 rounded text-sm font-semibold disabled:opacity-60 transition-all',
                            'bg-blue-500 text-white hover:bg-blue-600',
                            'shadow-lg flex-1'
                          )}
                          onClick={() => handleDepositClick(position)}
                        >
                          Deposit
                        </button>
                        <button
                          className={cn(
                            'px-3 py-1 rounded text-sm font-semibold disabled:opacity-60 transition-all',
                            'bg-green-500 text-white hover:bg-green-600',
                            'shadow-lg flex-1'
                          )}
                          onClick={() => handleWithdrawClick(position)}
                          disabled={isWithdrawing}
                        >
                          {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </ScrollArea>
      <div className="flex items-center justify-between pt-6 pb-6">
        <span className="text-xl">Total assets in Echelon:</span>
        <div className="text-right">
          <span className="text-xl text-primary font-bold">${totalValue.toFixed(2)}</span>
          {calculateRewardsValue() > 0 && (
            <div className="flex flex-col items-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-sm text-muted-foreground cursor-help">
                     💰 including rewards ${calculateRewardsValue().toFixed(2)}
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
              {rewardsData.length > 0 && (
                <button
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold disabled:opacity-60 hover:bg-green-700 transition-colors"
                  onClick={() => setShowClaimAllModal(true)}
                  disabled={isClaiming}
                >
                  {isClaiming ? 'Claiming...' : `Claim All Rewards (${rewardsData.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      {selectedPosition && (
        <DepositModal
          isOpen={showDepositModal}
          onClose={() => {
            setShowDepositModal(false);
            setSelectedPosition(null);
          }}
          protocol={{
            name: "Echelon",
            logo: "/echelon-favicon.ico",
            apy: (() => {
              const apyValue = getApyForPosition(selectedPosition) ? getApyForPosition(selectedPosition)! * 100 : 0;
              console.log('DepositModal - APY value being passed:', apyValue);
              return apyValue;
            })(),
            key: "echelon" as ProtocolKey
          }}
          tokenIn={{
            symbol: getTokenInfo(selectedPosition.coin)?.symbol || selectedPosition.coin.substring(0, 4).toUpperCase(),
            logo: getTokenInfo(selectedPosition.coin)?.logoUrl || '/file.svg',
            decimals: getTokenInfo(selectedPosition.coin)?.decimals || 8,
            address: selectedPosition.coin
          }}
          tokenOut={{
            symbol: getTokenInfo(selectedPosition.coin)?.symbol || selectedPosition.coin.substring(0, 4).toUpperCase(),
            logo: getTokenInfo(selectedPosition.coin)?.logoUrl || '/file.svg',
            decimals: getTokenInfo(selectedPosition.coin)?.decimals || 8,
            address: selectedPosition.coin
          }}
          priceUSD={parseFloat(getTokenPrice(selectedPosition.coin)) || 0}
        />
      )}

      {/* Withdraw Modal */}
      {selectedPosition && (
        <WithdrawModal
          isOpen={showWithdrawModal}
          onClose={() => {
            setShowWithdrawModal(false);
            setSelectedPosition(null);
            isModalOpenRef.current = false;
            if (selectedPosition) {
              closePositionModal(selectedPosition.coin);
            }
            closeAllModals();
          }}
          onConfirm={handleWithdrawConfirm}
          position={{ ...selectedPosition, supply: String(selectedPosition.amount) }}
          tokenInfo={getTokenInfo(selectedPosition.coin)}
          isLoading={isWithdrawing}
          userAddress={account?.address?.toString()}
        />
      )}

      {/* Claim All Rewards Modal */}
      <ClaimAllRewardsEchelonModal
        isOpen={showClaimAllModal}
        onClose={() => setShowClaimAllModal(false)}
        rewards={rewardsData}
        tokenPrices={tokenPrices}
      />
    </div>
  );
} 