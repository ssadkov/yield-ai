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
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [rewardsData, setRewardsData] = useState<any[]>([]);
  const [totalRewardsValue, setTotalRewardsValue] = useState<number>(0);

  const walletAddress = address || account?.address;

  // Claim individual reward
  const handleClaimReward = async (reward: any) => {
    if (!reward.reward_id || !reward.farming_identifier) {
      console.error('Missing reward_id or farming_identifier');
      return;
    }

    try {
      await claimRewards('moar', [reward.farming_identifier], [reward.reward_id]);
      // Refresh rewards data after successful claim
      setTimeout(() => {
        fetchRewards();
      }, 2000);
    } catch (error) {
      console.error('Error claiming reward:', error);
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
        
        // Вычисляем общую стоимость rewards
        const totalRewards = data.data.reduce((sum: number, reward: any) => {
          return sum + (reward.usdValue || 0);
        }, 0);
        
        setTotalRewardsValue(totalRewards);
      } else {
        setRewardsData([]);
        setTotalRewardsValue(0);
      }
    } catch (err) {
      console.error('Error fetching Moar rewards:', err);
      setRewardsData([]);
      setTotalRewardsValue(0);
    }
  }, [walletAddress]);

  // Получаем информацию о токене
  const getTokenInfo = useCallback((symbol: string) => {
    const token = (tokenList as any).data.data.find((token: any) => 
      token.symbol === symbol
    );
    
    if (!token) {
      return {
        symbol: symbol,
        logoUrl: '/protocol_ico/default-token.png',
        decimals: 8
      };
    }
    
    return {
      symbol: token.symbol,
      logoUrl: token.logoUrl,
      decimals: token.decimals
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

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Loading Moar Market positions...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500 text-center">Error: {error}</div>;
  }

  if (positions.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No Moar Market positions found</div>;
  }

  // Сортируем позиции по стоимости (от большей к меньшей)
  const sortedPositions = [...positions].sort((a, b) => parseFloat(b.value || "0") - parseFloat(a.value || "0"));

  return (
    <div className="space-y-3 sm:space-y-4 text-base">
      <ScrollArea className="h-[60vh] sm:h-auto">
        {sortedPositions.map((position, index) => {
          const tokenInfo = getTokenInfo(position.assetInfo.symbol);
          const value = parseFloat(position.value || "0");
          
          // Получаем количество токенов из balance (raw) и конвертируем в human-readable
          const rawBalance = position.balance || "0";
          const amount = parseFloat(rawBalance) / Math.pow(10, tokenInfo.decimals);
          const tokenPrice = amount > 0 ? value / amount : 0;
          
          // Debug logging
          console.log('Moar Position Debug:', {
            symbol: tokenInfo.symbol,
            rawBalance,
            decimals: tokenInfo.decimals,
            amount,
            value,
            tokenPrice
          });
          
          // Находим rewards для этой позиции (если есть)
          const positionRewards = rewardsData.filter((reward: any) => 
            reward.farming_identifier && reward.farming_identifier.includes(position.poolId)
          );
          
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
                      ${tokenPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">${value.toFixed(2)}</div>
                  <div className="text-base text-muted-foreground font-semibold">
                    {amount.toFixed(4)}
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
                                {reward.token_info?.logoUrl && (
                                  <Image 
                                    src={reward.token_info.logoUrl} 
                                    alt={reward.token_info.symbol}
                                    width={12}
                                    height={12}
                                    className="object-contain"
                                  />
                                )}
                                <span className="text-gray-600">{reward.token_info?.symbol || 'Unknown'}</span>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">${reward.usdValue?.toFixed(2) || '0.00'}</div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-black text-white border-gray-700">
                            <div className="text-xs">
                              <div className="text-gray-300">{reward.amount?.toFixed(6) || '0'} {reward.token_info?.symbol || 'Unknown'}</div>
                              <div className="text-gray-300">${reward.usdValue?.toFixed(2) || '0.00'}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                  
                  {/* Individual claim buttons for Desktop */}
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex gap-2">
                      {positionRewards.map((reward: any, rewardIdx: number) => (
                        <button
                          key={rewardIdx}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs font-semibold disabled:opacity-60 flex-1"
                          onClick={() => handleClaimReward(reward)}
                          disabled={isClaiming}
                        >
                          {isClaiming ? 'Claiming...' : `Claim ${reward.token_info?.symbol || 'Reward'}`}
                        </button>
                      ))}
                    </div>
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
                        ${tokenPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">${value.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">
                      {amount.toFixed(4)}
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
                                  <span className="text-gray-600">{reward.token_info?.symbol || 'Unknown'}</span>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">${reward.usdValue?.toFixed(2) || '0.00'}</div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-black text-white border-gray-700">
                              <div className="text-xs">
                                <div className="text-gray-300">{reward.amount?.toFixed(6) || '0'} {reward.token_info?.symbol || 'Unknown'}</div>
                                <div className="text-gray-300">${reward.usdValue?.toFixed(2) || '0.00'}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                    
                    {/* Individual claim buttons for Mobile */}
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="space-y-2">
                        {positionRewards.map((reward: any, rewardIdx: number) => (
                          <button
                            key={rewardIdx}
                            className="w-full px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold disabled:opacity-60"
                            onClick={() => handleClaimReward(reward)}
                            disabled={isClaiming}
                          >
                            {isClaiming ? 'Claiming...' : `Claim ${reward.token_info?.symbol || 'Reward'}`}
                          </button>
                        ))}
                      </div>
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
            <span className="text-xl text-primary font-bold">${(totalValue + totalRewardsValue).toFixed(2)}</span>
          </div>
          {totalRewardsValue > 0 && (
            <div className="flex justify-end mt-2">
              <div className="text-right">
                <div className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                  <span>💰</span>
                  <span>including rewards ${totalRewardsValue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Mobile layout */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-lg">Total assets in Moar Market:</span>
            <span className="text-lg text-primary font-bold">${(totalValue + totalRewardsValue).toFixed(2)}</span>
          </div>
          {totalRewardsValue > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <span>💰</span>
                <span>including rewards ${totalRewardsValue.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
