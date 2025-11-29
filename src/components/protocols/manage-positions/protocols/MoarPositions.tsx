import React, { useEffect, useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import tokenList from "@/lib/data/tokenList.json";
import { useClaimRewards } from '@/lib/hooks/useClaimRewards';
import { useWithdraw } from '@/lib/hooks/useWithdraw';
import { useToast } from '@/components/ui/use-toast';
import { useWalletStore } from '@/lib/stores/walletStore';
import { WithdrawModal } from '@/components/ui/withdraw-modal';
import { DepositModal } from '@/components/ui/deposit-modal';
import { formatNumber, formatCurrency } from '@/lib/utils/numberFormat';

interface MoarPositionsProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

interface Position {
  poolId: string;
  assetInfo: {
    symbol: string;
    logoUrl: string;
    decimals: number;
  };
  amount: number;
  value: string;
  balance: string;
}

export function MoarPositions({ address, onPositionsValueChange }: MoarPositionsProps) {
  const { account } = useWallet();
  const { claimRewards, isLoading: isClaiming } = useClaimRewards();
  const { withdraw, isLoading: isWithdrawing } = useWithdraw();
  const { toast } = useToast();
  const { setRewards } = useWalletStore();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [rewardsData, setRewardsData] = useState<any[]>([]);
  const [totalRewardsValue, setTotalRewardsValue] = useState<number>(0);
  const [poolsAPR, setPoolsAPR] = useState<Record<number, any>>({});
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedDepositPosition, setSelectedDepositPosition] = useState<Position | null>(null);

  const walletAddress = address || account?.address;

  // Fetch pools APR data
  const fetchPoolsAPR = useCallback(async () => {
    try {
      console.log('🔍 Fetching Moar Market pools APR...');
      const response = await fetch('/api/protocols/moar/pools');
      console.log('📊 APR API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 APR API response data:', data);
        
        if (data.success && data.data) {
          const aprMap: Record<number, any> = {};
          data.data.forEach((pool: any) => {
            if (pool.poolId !== undefined) {
              // totalAPY already comes in percentage format from API (e.g., 8.4, not 0.084)
              aprMap[pool.poolId] = {
                totalAPR: pool.totalAPY || 0,
                interestRateComponent: pool.interestRateComponent || 0,
                farmingAPY: pool.farmingAPY || 0
              };
            }
          });
          setPoolsAPR(aprMap);
          console.log('📊 Loaded APR data for pools:', aprMap);
        } else {
          console.warn('📊 APR API returned no data or success=false:', data);
        }
      } else {
        console.error('📊 APR API failed with status:', response.status);
        const errorText = await response.text();
        console.error('📊 APR API error response:', errorText);
      }
    } catch (error) {
      console.error('📊 Failed to fetch pools APR:', error);
    }
  }, []);

  // Обработчик открытия модального окна withdraw
  const handleWithdrawClick = (position: Position) => {
    setSelectedPosition(position);
    setShowWithdrawModal(true);
  };

  // Обработчик открытия модального окна deposit
  const handleDepositClick = (position: Position) => {
    setSelectedDepositPosition(position);
    setShowDepositModal(true);
  };

  // Обработчик подтверждения withdraw
  const handleWithdrawConfirm = async (amount: bigint) => {
    if (!selectedPosition) return;
    
    try {
      // Получаем token address из underlying_asset
      let tokenAddress = '';
      if (selectedPosition.assetInfo.symbol === 'APT') {
        tokenAddress = '0x1::aptos_coin::AptosCoin';
      } else if (selectedPosition.assetInfo.symbol === 'USDC') {
        tokenAddress = '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b';
      } else {
        // Fallback - используем symbol для поиска в tokenList
        const tokenInfo = getTokenInfo(selectedPosition.assetInfo.symbol);
        tokenAddress = tokenInfo.address || selectedPosition.assetInfo.symbol;
      }
      
      // Вызываем withdraw через useWithdraw hook
      // Для Moar Market: marketAddress = poolId, token = underlying_asset
      console.log('Calling withdraw with:', {
        protocol: 'moar',
        poolId: selectedPosition.poolId,
        amount: amount.toString(),
        tokenAddress
      });
      
      await withdraw('moar', selectedPosition.poolId, amount, tokenAddress);
      
      // Закрываем модал и обновляем состояние
      setShowWithdrawModal(false);
      setSelectedPosition(null);
      
      // Обновляем позиции после успешного withdraw
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshPositions', { 
          detail: { protocol: 'moar' }
        }));
      }, 2000);
      
    } catch (error) {
      console.error('Withdraw failed:', error);
      
      // Показываем пользователю понятное сообщение об ошибке
      let errorMessage = 'Withdraw failed. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit') || error.message.includes('Too Many Requests')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for this transaction.';
        } else if (error.message.includes('JSON')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = `Withdraw failed: ${error.message}`;
        }
      }
      
      toast({
        title: "Withdraw Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };


  // Claim all rewards
  const handleClaimAllRewards = async () => {
    if (!rewardsData || rewardsData.length === 0) {
      console.log('No rewards to claim');
      return;
    }

    try {
      // Group rewards by farming_identifier to avoid duplicate calls
      const rewardsByPool = new Map();
      rewardsData.forEach((reward: any) => {
        if (reward.farming_identifier && reward.reward_id) {
          if (!rewardsByPool.has(reward.farming_identifier)) {
            rewardsByPool.set(reward.farming_identifier, []);
          }
          rewardsByPool.get(reward.farming_identifier).push(reward.reward_id);
        }
      });

      let totalClaimedRewards = 0;
      let lastTransactionHash = '';

      // Claim rewards for each pool
      for (const [farmingIdentifier, rewardIds] of rewardsByPool) {
        console.log(`Claiming rewards for pool ${farmingIdentifier}:`, rewardIds);
        const result = await claimRewards('moar', [farmingIdentifier], rewardIds);
        
        // Extract transaction hash if available
        if (result && result.hash) {
          lastTransactionHash = result.hash;
        }
        
        totalClaimedRewards += rewardIds.length;
        
        // Small delay between claims to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Show success notification with explorer link
      toast({
        title: "Success!",
        description: (
          <div className="space-y-2">
            <p>Successfully claimed {totalClaimedRewards} rewards from Moar Market</p>
            {lastTransactionHash && (
              <a 
                href={`https://explorer.aptoslabs.com/txn/${lastTransactionHash}?network=mainnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                View transaction on Explorer →
              </a>
            )}
          </div>
        ),
      });

      // Refresh rewards data after successful claim
      setTimeout(() => {
        fetchRewards();
      }, 2000);
    } catch (error) {
      console.error('Error claiming all rewards:', error);
      toast({
        title: "Error",
        description: "Failed to claim rewards. Please try again.",
        variant: "destructive"
      });
    }
  };


  // Загрузка rewards
  const fetchRewards = useCallback(async () => {
    if (!walletAddress) return;
    
    try {
      const response = await fetch(`/api/protocols/moar/rewards?address=${walletAddress}`);
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setRewardsData(data.data);
        
        // Сохраняем rewards в store для общего claim all
        console.log('[MoarPositions] Saving rewards to store:', data.data);
        setRewards('moar', data.data);
        
        // Вычисляем общую стоимость rewards
        const totalRewards = data.data.reduce((sum: number, reward: any) => {
          return sum + (reward.usdValue || 0);
        }, 0);
        
        setTotalRewardsValue(totalRewards);
      } else {
        setRewardsData([]);
        setRewards('moar', []); // Очищаем store если нет данных
        setTotalRewardsValue(0);
      }
    } catch (err) {
      console.error('Error fetching Moar rewards:', err);
      setRewardsData([]);
      setRewards('moar', []); // Очищаем store при ошибке
      setTotalRewardsValue(0);
    }
  }, [walletAddress, setRewards]);

  // Получаем информацию о токене
  const getTokenInfo = useCallback((symbol: string) => {
    const token = (tokenList as any).data.data.find((token: any) => 
      token.symbol === symbol
    );
    
    if (!token) {
      return {
        symbol: symbol,
        logoUrl: '/protocol_ico/default-token.png',
        decimals: 8,
        address: symbol // Fallback to symbol if no token found
      };
    }
    
    return {
      symbol: token.symbol,
      logoUrl: token.logoUrl,
      decimals: token.decimals,
      address: token.tokenAddress || token.faAddress || symbol
    };
  }, []);

  // Загрузка позиций и rewards
  useEffect(() => {
    if (!walletAddress) {
      setPositions([]);
      setTotalValue(0);
      setRewardsData([]);
      setTotalRewardsValue(0);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Загружаем позиции и rewards параллельно
        const [positionsResponse, rewardsResponse] = await Promise.all([
          fetch(`/api/protocols/moar/userPositions?address=${walletAddress}`),
          fetch(`/api/protocols/moar/rewards?address=${walletAddress}`)
        ]);
        
        const positionsData = await positionsResponse.json();
        const rewardsData = await rewardsResponse.json();
        
        // Обрабатываем позиции
        if (positionsData.success && Array.isArray(positionsData.data)) {
          setPositions(positionsData.data);
          
          // Вычисляем общую стоимость позиций
          const total = positionsData.data.reduce((sum: number, position: Position) => {
            return sum + parseFloat(position.value || "0");
          }, 0);
          
          setTotalValue(total);
        } else {
          setPositions([]);
          setTotalValue(0);
        }
        
        // Обрабатываем rewards
        if (rewardsData.success && Array.isArray(rewardsData.data)) {
          setRewardsData(rewardsData.data);
          
          // Вычисляем общую стоимость rewards
          const totalRewards = rewardsData.data.reduce((sum: number, reward: any) => {
            return sum + (reward.usdValue || 0);
          }, 0);
          
          setTotalRewardsValue(totalRewards);
        } else {
          setRewardsData([]);
          setTotalRewardsValue(0);
        }
        
        // Обновляем общую стоимость (позиции + rewards)
        const totalPositions = positionsData.success ? positionsData.data.reduce((sum: number, position: Position) => {
          return sum + parseFloat(position.value || "0");
        }, 0) : 0;
        
        const totalRewards = rewardsData.success ? rewardsData.data.reduce((sum: number, reward: any) => {
          return sum + (reward.usdValue || 0);
        }, 0) : 0;
        
        onPositionsValueChange?.(totalPositions + totalRewards);
        
      } catch (err) {
        console.error('Error fetching Moar data:', err);
        setError("Failed to load Moar Market data");
        setPositions([]);
        setTotalValue(0);
        setRewardsData([]);
        setTotalRewardsValue(0);
        onPositionsValueChange?.(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [walletAddress, onPositionsValueChange]);

  // Fetch pools APR data separately
  useEffect(() => {
    console.log('🔄 MoarPositions useEffect triggered - calling fetchPoolsAPR');
    fetchPoolsAPR();
  }, []); // Empty deps - call once on mount

  // Подписка на глобальное событие обновления позиций
  useEffect(() => {
    const handleRefresh = (event: CustomEvent) => {
      console.log('MoarPositions - Received refreshPositions event:', event.detail);
      
      if (event.detail?.protocol === 'moar') {
        console.log('MoarPositions - Protocol matches moar, refreshing data');
        // Перезагружаем данные
        const fetchData = async () => {
          try {
            setLoading(true);
            setError(null);
            
            // Загружаем позиции и rewards параллельно
            const [positionsResponse, rewardsResponse] = await Promise.all([
              fetch(`/api/protocols/moar/userPositions?address=${walletAddress}`),
              fetch(`/api/protocols/moar/rewards?address=${walletAddress}`)
            ]);
            
            const positionsData = await positionsResponse.json();
            const rewardsData = await rewardsResponse.json();
            
            console.log('Moar Market positions refreshed:', positionsData);
            console.log('Moar Market rewards refreshed:', rewardsData);
            
            // Обрабатываем позиции
            if (positionsData.success && Array.isArray(positionsData.data)) {
              setPositions(positionsData.data);
              
              // Вычисляем общую стоимость позиций
              const total = positionsData.data.reduce((sum: number, position: Position) => {
                return sum + parseFloat(position.value || "0");
              }, 0);
              
              setTotalValue(total);
            } else {
              setPositions([]);
              setTotalValue(0);
            }
            
            // Обрабатываем rewards
            if (rewardsData.success && Array.isArray(rewardsData.data)) {
              setRewardsData(rewardsData.data);
              
              // Вычисляем общую стоимость rewards
              const totalRewards = rewardsData.data.reduce((sum: number, reward: any) => {
                return sum + (reward.usdValue || 0);
              }, 0);
              
              setTotalRewardsValue(totalRewards);
            } else {
              setRewardsData([]);
              setTotalRewardsValue(0);
            }
            
            // Обновляем общую стоимость (позиции + rewards)
            const totalPositions = positionsData.success ? positionsData.data.reduce((sum: number, position: Position) => {
              return sum + parseFloat(position.value || "0");
            }, 0) : 0;
            
            const totalRewards = rewardsData.success ? rewardsData.data.reduce((sum: number, reward: any) => {
              return sum + (reward.usdValue || 0);
            }, 0) : 0;
            
            onPositionsValueChange?.(totalPositions + totalRewards);
            
          } catch (err) {
            console.error('Error refreshing Moar data:', err);
            setError("Failed to refresh Moar Market data");
          } finally {
            setLoading(false);
          }
        };
        
        fetchData();
        
        // Также обновляем APR данные
        fetchPoolsAPR();
      }
    };

    window.addEventListener('refreshPositions', handleRefresh as unknown as EventListener);
    return () => {
      window.removeEventListener('refreshPositions', handleRefresh as unknown as EventListener);
    };
  }, [walletAddress, onPositionsValueChange]);

  if (loading) {
    return <div>Loading Moar Market positions...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (positions.length === 0) {
    return null;
  }

  // Сортируем позиции по стоимости (от большей к меньшей)
  const sortedPositions = [...positions].sort((a, b) => parseFloat(b.value || "0") - parseFloat(a.value || "0"));

  return (
    <div className="space-y-3 sm:space-y-4 text-base">
      <ScrollArea className="sm:h-auto">
        {sortedPositions.map((position, index) => {
          const tokenInfo = getTokenInfo(position.assetInfo.symbol);
          const value = parseFloat(position.value || "0");
          
          // Получаем количество токенов из balance (raw) и конвертируем в human-readable
          const rawBalance = position.balance || "0";
          const amount = parseFloat(rawBalance) / Math.pow(10, tokenInfo.decimals);
          const tokenPrice = amount > 0 ? value / amount : 0;
          
          
          // Находим rewards для этой позиции (если есть)
          // Сопоставляем по poolId с farming_identifier (приводим к строке для сравнения)
          const positionRewards = rewardsData.filter((reward: any) => 
            reward.farming_identifier && reward.farming_identifier === position.poolId.toString()
          );
          
          // Получаем APR данные для этого пула
          const poolId = parseInt(position.poolId);
          const poolAPR = poolsAPR[poolId];
          
          
          return (
            <div 
              key={`${position.poolId}-${index}`} 
              className="p-3 sm:p-4 border-b last:border-b-0 transition-colors"
            >
              {/* Desktop Layout */}
              <div className="hidden sm:flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {tokenInfo.logoUrl && (
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
                      <div className="text-lg font-semibold">{tokenInfo.symbol}</div>
                      <Badge 
                        variant="outline" 
                        className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5"
                      >
                        Supply
                      </Badge>
                    </div>
                    <div className="text-base text-muted-foreground mt-0.5">
                      {formatCurrency(tokenPrice)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    {poolAPR && poolAPR.totalAPR > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="outline" 
                              className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-2 py-0.5 h-5 cursor-help"
                            >
                              APR: {formatNumber(poolAPR.totalAPR, 2)}%
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">APR Breakdown</p>
                              <p className="text-xs">Interest Rate: {poolAPR.interestRateComponent.toFixed(2)}%</p>
                              <p className="text-xs">Farming APY: {poolAPR.farmingAPY.toFixed(2)}%</p>
                              <p className="text-xs font-semibold">Total: {poolAPR.totalAPR.toFixed(2)}%</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <div className="text-lg font-bold text-right w-24">{formatCurrency(value)}</div>
                  </div>
                  <div className="text-base text-muted-foreground font-semibold">
                    {formatNumber(amount, 4)}
                  </div>
                  <div className="flex gap-2 mt-2 justify-end">
                    <Button
                      onClick={() => handleDepositClick(position)}
                      disabled={false}
                      size="sm"
                      variant="default"
                      className="h-10"
                    >
                      Deposit
                    </Button>
                    {amount > 0 && (
                      <Button
                        onClick={() => handleWithdrawClick(position)}
                        disabled={isWithdrawing}
                        size="sm"
                        variant="outline"
                        className="h-10"
                      >
                        {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Rewards section для Desktop */}
              {positionRewards.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-600 mb-1">💰 Supply Rewards</div>
                  <div className="space-y-1">
                    {positionRewards.map((reward: any, rewardIdx: number) => (
                      <TooltipProvider key={rewardIdx}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-between text-xs cursor-help">
                              <div className="flex items-center gap-1">
                                {reward.logoUrl && (
                                  <Image 
                                    src={reward.logoUrl} 
                                    alt={reward.symbol}
                                    width={12}
                                    height={12}
                                    className="object-contain"
                                  />
                                )}
                                <span className="text-gray-600">{reward.symbol || 'Unknown'}</span>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{formatCurrency(reward.usdValue || 0)}</div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover text-popover-foreground border-border">
                            <div className="text-xs">
                              <div className="text-gray-300">{formatNumber(reward.amount || 0, 6)} {reward.token_info?.symbol || 'Unknown'}</div>
                              <div className="text-gray-300">{formatCurrency(reward.usdValue || 0)}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                  
                </div>
              )}

              {/* Mobile Layout */}
              <div className="block sm:hidden space-y-3">
                {/* Верхняя строка - токен и значение */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {tokenInfo.logoUrl && (
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
                      <div className="text-base font-semibold">{tokenInfo.symbol}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(tokenPrice)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      {poolAPR && poolAPR.totalAPR > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant="outline" 
                                className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-2 py-0.5 h-5 cursor-help"
                              >
                                APR: {formatNumber(poolAPR.totalAPR, 2)}%
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                <p className="font-medium">APR Breakdown</p>
                                <p className="text-xs">Interest Rate: {(poolAPR.interestRateComponent * 100).toFixed(2)}%</p>
                                <p className="text-xs">Farming APY: {poolAPR.farmingAPY.toFixed(2)}%</p>
                                <p className="text-xs font-semibold">Total: {poolAPR.totalAPR.toFixed(2)}%</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <div className="text-lg font-bold text-right w-24">{formatCurrency(value)}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatNumber(amount, 4)}
                    </div>
                    <div className="flex gap-2 mt-2 justify-end">
                      <Button
                        onClick={() => handleDepositClick(position)}
                        disabled={false}
                        size="sm"
                        variant="default"
                        className="h-10"
                      >
                        Deposit
                      </Button>
                      {amount > 0 && (
                        <Button
                          onClick={() => handleWithdrawClick(position)}
                          disabled={isWithdrawing}
                          size="sm"
                          variant="outline"
                          className="h-10"
                        >
                          {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Средняя строка - бейджи */}
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant="outline" 
                    className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-1 h-6"
                  >
                    Supply
                  </Badge>
                </div>
                
                {/* Rewards section для Mobile */}
                {positionRewards.length > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <div className="text-xs font-medium text-gray-600 mb-1">💰 Supply Rewards</div>
                    <div className="space-y-1">
                      {positionRewards.map((reward: any, rewardIdx: number) => (
                        <TooltipProvider key={rewardIdx}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-between text-xs cursor-help">
                                <div className="flex items-center gap-1">
                                  {reward.token_info?.logoUrl && (
                                    <Image 
                                      src={reward.token_info.logoUrl} 
                                      alt={reward.token_info.symbol}
                                      width={12}
                                      height={12}
                                      className="object-contain"
                                    />
                                  )}
                                  <span className="text-gray-600">{reward.symbol || 'Unknown'}</span>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">{formatCurrency(reward.usdValue || 0)}</div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-popover text-popover-foreground border-border">
                              <div className="text-xs">
                                <div className="text-gray-300">{formatNumber(reward.amount || 0, 6)} {reward.symbol || 'Unknown'}</div>
                                <div className="text-gray-300">{formatCurrency(reward.usdValue || 0)}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                    
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </ScrollArea>
      
      {/* Total Value Summary */}
      <div className="pt-6 pb-6">
        {/* Desktop layout */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between">
            <span className="text-xl">Total assets in Moar Market:</span>
            <span className="text-xl text-primary font-bold">{formatCurrency(totalValue + totalRewardsValue)}</span>
          </div>
          {totalRewardsValue > 0 && (
            <div className="flex justify-end mt-2">
              <div className="text-right">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 justify-end cursor-help">
                        <span>💰</span>
                        <span>including rewards {formatCurrency(totalRewardsValue)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border-border max-w-xs">
                      <div className="text-xs font-semibold mb-1">Rewards breakdown:</div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {rewardsData.map((reward: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            {reward.logoUrl && (
                              <img src={reward.logoUrl} alt={reward.symbol} className="w-3 h-3 rounded-full" />
                            )}
                            <span>{reward.symbol}</span>
                            <span>{formatNumber(reward.amount || 0, 6)}</span>
                            <span className="text-gray-300">{formatCurrency(reward.usdValue || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* Claim All Rewards Button */}
                <div className="mt-3">
                  <Button
                    onClick={handleClaimAllRewards}
                    disabled={isClaiming}
                    className="bg-success text-success-foreground hover:bg-success/90"
                  >
                    {isClaiming ? 'Claiming...' : 'Claim'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Mobile layout */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-lg">Total assets in Moar Market:</span>
            <span className="text-lg text-primary font-bold">{formatCurrency(totalValue + totalRewardsValue)}</span>
          </div>
          {totalRewardsValue > 0 && (
            <div className="space-y-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                      <span>💰</span>
                      <span>including rewards ${totalRewardsValue.toFixed(2)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover text-popover-foreground border-border max-w-xs">
                    <div className="text-xs font-semibold mb-1">Rewards breakdown:</div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {rewardsData.map((reward: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          {reward.logoUrl && (
                            <img src={reward.logoUrl} alt={reward.symbol} className="w-3 h-3 rounded-full" />
                          )}
                          <span>{reward.symbol}</span>
                          <span>{reward.amount?.toFixed(6) || '0'}</span>
                          <span className="text-gray-300">${reward.usdValue?.toFixed(2) || '0.00'}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {/* Claim All Rewards Button for Mobile */}
              <div className="pt-2">
                <Button
                  onClick={handleClaimAllRewards}
                  disabled={isClaiming}
                  className="w-full bg-success text-success-foreground hover:bg-success/90"
                >
                  {isClaiming ? 'Claiming...' : 'Claim'}
                </Button>
              </div>
            </div>
          )}
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
            coin: selectedPosition.assetInfo.symbol,
            supply: selectedPosition.balance,
            market: selectedPosition.poolId
          }}
          tokenInfo={{
            symbol: selectedPosition.assetInfo.symbol,
            logoUrl: selectedPosition.assetInfo.logoUrl,
            decimals: selectedPosition.assetInfo.decimals
          }}
          isLoading={isWithdrawing}
          userAddress={walletAddress?.toString()}
        />
      )}

      {/* Deposit Modal */}
      {selectedDepositPosition && (
        <DepositModal
          isOpen={showDepositModal}
          onClose={() => {
            setShowDepositModal(false);
            setSelectedDepositPosition(null);
          }}
          protocol={{
            name: "Moar Market",
            logo: "/protocol_ico/moar-market-logo-primary.png",
            apy: (() => {
              const poolId = parseInt(selectedDepositPosition.poolId);
              const poolAPR = poolsAPR[poolId];
              return poolAPR ? poolAPR.totalAPR : 0;
            })(),
            key: "moar" as any
          }}
          tokenIn={{
            symbol: selectedDepositPosition.assetInfo.symbol,
            logo: selectedDepositPosition.assetInfo.logoUrl,
            decimals: selectedDepositPosition.assetInfo.decimals,
            address: (() => {
              if (selectedDepositPosition.assetInfo.symbol === 'APT') {
                return '0x1::aptos_coin::AptosCoin';
              } else if (selectedDepositPosition.assetInfo.symbol === 'USDC') {
                return '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b';
              }
              return selectedDepositPosition.assetInfo.symbol;
            })()
          }}
          tokenOut={{
            symbol: selectedDepositPosition.assetInfo.symbol,
            logo: selectedDepositPosition.assetInfo.logoUrl,
            decimals: selectedDepositPosition.assetInfo.decimals,
            address: (() => {
              if (selectedDepositPosition.assetInfo.symbol === 'APT') {
                return '0x1::aptos_coin::AptosCoin';
              } else if (selectedDepositPosition.assetInfo.symbol === 'USDC') {
                return '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b';
              }
              return selectedDepositPosition.assetInfo.symbol;
            })()
          }}
          priceUSD={4.40} // TODO: Get real price from API
        />
      )}
    </div>
  );
}
