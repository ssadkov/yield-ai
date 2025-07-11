import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ManagePositionsButton } from "../../ManagePositionsButton";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { useClaimRewards } from '@/lib/hooks/useClaimRewards';

interface AuroPositionsProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

export function AuroPositions({ address, onPositionsValueChange }: AuroPositionsProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [poolsData, setPoolsData] = useState<any[]>([]);
  const [rewardsData, setRewardsData] = useState<{ [positionAddress: string]: { collateral: any[], borrow: any[] } }>({});
  const { claimRewards, isLoading: isClaiming } = useClaimRewards();

  const walletAddress = address || account?.address;
  const protocol = getProtocolByName("Auro Finance");

  // useEffect для загрузки позиций
  useEffect(() => {
    if (!walletAddress) {
      setPositions([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/protocols/auro/userPositions?address=${walletAddress}`)
      .then(res => res.json())
      .then(data => {
        setPositions(Array.isArray(data.positionInfo) ? data.positionInfo : []);
      })
      .catch(err => {
        setError("Failed to load Auro Finance positions");
        setPositions([]);
      })
      .finally(() => setLoading(false));
  }, [walletAddress]);

  // useEffect для загрузки данных пулов
  useEffect(() => {
    fetch('/api/protocols/auro/pools')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setPoolsData(data.data);
        }
      })
      .catch(error => {
        console.error('Error loading Auro pools data:', error);
      });
  }, []);

  // useEffect для загрузки наград
  useEffect(() => {
    if (positions.length === 0 || poolsData.length === 0) return;

    const fetchRewards = async () => {
      try {
        console.log('Fetching rewards for positions:', positions.length);
        console.log('Available pools:', poolsData.length);
        
        // Формируем positionsInfo в нужном формате
        const positionsInfo = positions.map(pos => ({
          address: pos.address,
          poolAddress: pos.poolAddress,
          debtAmount: pos.debtAmount
        }));

        // Формируем poolsData в нужном формате
        const formattedPoolsData = poolsData.map(pool => ({
          type: pool.type,
          poolAddress: pool.poolAddress,
          rewardPoolAddress: pool.rewardPoolAddress,
          borrowRewardsPoolAddress: pool.borrowRewardsPoolAddress
        }));

        console.log('Positions info:', positionsInfo);
        console.log('Formatted pools data:', formattedPoolsData);

        if (positionsInfo.length === 0 || formattedPoolsData.length === 0) {
          console.log('No positions or pools found');
          return;
        }

        const requestBody = {
          positionsInfo,
          poolsData: formattedPoolsData
        };

        console.log('Sending request:', requestBody);

        const response = await fetch('/api/protocols/auro/rewards', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('Rewards response:', data);
          
          if (data.success && data.data) {
            setRewardsData(data.data);
            console.log('Set rewards data:', data.data);
          } else {
            console.log('Invalid rewards response format:', data);
            setRewardsData({});
          }
        } else {
          const errorText = await response.text();
          console.error('Rewards API error:', response.status, errorText);
          setRewardsData({});
        }
      } catch (error) {
        console.error('Error loading rewards:', error);
        setRewardsData({});
      }
    };

    fetchRewards();
  }, [positions, poolsData]);

  // Вспомогательная функция для получения информации о токене награды
  const getRewardTokenInfoHelper = (tokenAddress: string) => {
    // Ищем токен в poolsData
    const pool = poolsData.find(p => p.token?.address === tokenAddress);
    if (pool?.token) {
      return {
        symbol: pool.token.symbol,
        name: pool.token.name,
        icon_uri: pool.token.icon_uri,
        decimals: pool.token.decimals,
        price: pool.token.price
      };
    }
    
    // Fallback для AURO токена
    if (tokenAddress === '0xbcff91abababee684b194219ff2113c26e63d57c8872e6fdaf25a41a45fb7197') {
      return {
        symbol: 'AURO',
        name: 'AURO Finance',
        icon_uri: 'https://img.auro.finance/auro.png',
        decimals: 8,
        price: 0.0069
      };
    }
    
    return null;
  };

  // Функция для расчета стоимости наград позиции
  const calculateRewardsValue = (positionAddress: string) => {
    let rewardsValue = 0;
    if (rewardsData[positionAddress]) {
      // Collateral rewards
      rewardsData[positionAddress].collateral.forEach((reward: any) => {
        if (reward && reward.key && reward.value) {
          const tokenInfo = getRewardTokenInfoHelper(reward.key);
          if (tokenInfo && tokenInfo.price) {
            const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
            rewardsValue += amount * tokenInfo.price;
          }
        }
      });
      
      // Borrow rewards
      rewardsData[positionAddress].borrow.forEach((reward: any) => {
        if (reward && reward.key && reward.value) {
          const tokenInfo = getRewardTokenInfoHelper(reward.key);
          if (tokenInfo && tokenInfo.price) {
            const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
            rewardsValue += amount * tokenInfo.price;
          }
        }
      });
    }
    return rewardsValue;
  };

  // Сортировка по value (по убыванию) - включая награды
  const sortedPositions = [...positions].sort((a, b) => {
    const valueA = a.collateralTokenInfo?.usdPrice ? parseFloat(a.collateralAmount) * parseFloat(a.collateralTokenInfo.usdPrice) : 0;
    const valueB = b.collateralTokenInfo?.usdPrice ? parseFloat(b.collateralAmount) * parseFloat(b.collateralTokenInfo.usdPrice) : 0;
    
    // Добавляем стоимость наград для сортировки
    const rewardsValueA = calculateRewardsValue(a.address);
    const rewardsValueB = calculateRewardsValue(b.address);
    
    return (valueB + rewardsValueB) - (valueA + rewardsValueA);
  });

  // Функция для расчета общей стоимости всех наград
  const calculateTotalRewardsValue = () => {
    return sortedPositions.reduce((total, pos) => {
      return total + calculateRewardsValue(pos.address);
    }, 0);
  };

  // Мемоизируем общую стоимость наград для оптимизации
  const totalRewardsValue = calculateTotalRewardsValue();
  
  // Пересчитываем сортировку при изменении наград
  useEffect(() => {
    // Сортировка уже обновляется автоматически благодаря зависимости от rewardsData
  }, [rewardsData]);

  // Сумма активов
  useEffect(() => {
    const total = sortedPositions.reduce((sum, pos) => {
      const collateralValue = pos.collateralTokenInfo?.usdPrice ? parseFloat(pos.collateralAmount) * parseFloat(pos.collateralTokenInfo.usdPrice) : 0;
      const debtValue = pos.debtTokenInfo?.usdPrice ? parseFloat(pos.debtAmount) * parseFloat(pos.debtTokenInfo.usdPrice) : 0;
      
      // Добавляем стоимость наград
      const rewardsValue = calculateRewardsValue(pos.address);
      
      return sum + collateralValue - debtValue + rewardsValue;
    }, 0);
    setTotalValue(total);
    
    if (onPositionsValueChange) {
      onPositionsValueChange(total);
    }
  }, [sortedPositions, rewardsData, onPositionsValueChange]);

  // Получение реальных APR данных из API
  const getCollateralAPRData = (poolAddress: string) => {
    const pool = poolsData.find(p => p.poolAddress === poolAddress);
    if (!pool) return { totalApr: 0, supplyApr: 0, supplyIncentiveApr: 0, stakingApr: 0 };
    
    return {
      totalApr: pool.totalSupplyApr || 0,
      supplyApr: pool.supplyApr || 0,
      supplyIncentiveApr: pool.supplyIncentiveApr || 0,
      stakingApr: pool.stakingApr || 0,
      rewardPoolAddress: pool.rewardPoolAddress
    };
  };

  const getDebtAPRData = () => {
    const borrowPool = poolsData.find(p => p.type === 'BORROW');
    if (!borrowPool) return { totalApr: 0, borrowApr: 0, borrowIncentiveApr: 0 };
    
    const borrowApr = borrowPool.borrowApr || 0;
    const incentiveApr = borrowPool.borrowIncentiveApr || 0;
    const totalApr = incentiveApr - borrowApr; // Разность: Incentive - Borrow
    
    return {
      totalApr: totalApr,
      borrowApr: borrowApr,
      borrowIncentiveApr: incentiveApr,
      rewardPoolAddress: borrowPool.borrowRewardsPoolAddress
    };
  };



  // Получение наград для позиции
  const getPositionRewards = (positionAddress: string) => {
    const collateralRewards = rewardsData[positionAddress]?.collateral || [];
    const borrowRewards = rewardsData[positionAddress]?.borrow || [];
    return [...collateralRewards, ...borrowRewards];
  };

  // Собираем все positionIds и tokenTypes для claim
  const getClaimablePositionsAndTokens = () => {
    const positionIds: string[] = [];
    const tokenTypesSet = new Set<string>();
    Object.entries(rewardsData).forEach(([positionId, rewards]) => {
      const hasRewards =
        (rewards.collateral && rewards.collateral.length > 0) ||
        (rewards.borrow && rewards.borrow.length > 0);
      if (hasRewards) {
        positionIds.push(positionId);
        [...(rewards.collateral || []), ...(rewards.borrow || [])].forEach((reward: any) => {
          if (reward && reward.key) tokenTypesSet.add(reward.key);
        });
      }
    });
    return { positionIds, tokenTypes: Array.from(tokenTypesSet) };
  };

  const handleClaimAllRewards = async () => {
    const { positionIds, tokenTypes } = getClaimablePositionsAndTokens();
    if (positionIds.length === 0 || tokenTypes.length === 0) return;
    try {
      await claimRewards('auro', positionIds, tokenTypes);
    } catch (e) {
      // Ошибка уже обработана в hook
    }
  };

  // Подсчет общей суммы claimable rewards (USD)
  const totalClaimableRewards = Object.keys(rewardsData).reduce((sum, positionId) => {
    const rewards = rewardsData[positionId];
    let localSum = 0;
    if (rewards) {
      [...(rewards.collateral || []), ...(rewards.borrow || [])].forEach((reward: any) => {
        const tokenInfo = getRewardTokenInfoHelper(reward.key);
        if (tokenInfo && tokenInfo.price) {
          const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
          localSum += amount * tokenInfo.price;
        }
      });
    }
    return sum + localSum;
  }, 0);

  if (!walletAddress) return null;
  
  if (loading) {
    return (
      <div className="space-y-4 text-base">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-6 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="space-y-4 text-base">
        <div className="text-red-500 text-center py-4">{error}</div>
      </div>
    );
  }
  
  if (!positions || positions.length === 0) return null;

  return (
    <div className="space-y-4 text-base">
      <ScrollArea>
        {sortedPositions.map((pos, idx) => {
          const collateral = pos.collateralAmount;
          const collateralSymbol = pos.collateralSymbol;
          const collateralLogo = pos.collateralTokenInfo?.logoUrl;
          const collateralPrice = pos.collateralTokenInfo?.usdPrice ? parseFloat(pos.collateralTokenInfo.usdPrice).toFixed(2) : 'N/A';
          const collateralValue = pos.collateralTokenInfo?.usdPrice ? (parseFloat(collateral) * parseFloat(pos.collateralTokenInfo.usdPrice)).toFixed(2) : 'N/A';
          const collateralAPRData = getCollateralAPRData(pos.poolAddress);
          
          const debt = pos.debtAmount;
          const debtSymbol = pos.debtSymbol;
          const debtLogo = pos.debtTokenInfo?.logoUrl;
          const debtPrice = pos.debtTokenInfo?.usdPrice ? parseFloat(pos.debtTokenInfo.usdPrice).toFixed(2) : 'N/A';
          const debtValue = pos.debtTokenInfo?.usdPrice ? (parseFloat(debt) * parseFloat(pos.debtTokenInfo.usdPrice)).toFixed(2) : 'N/A';
          const debtAPRData = getDebtAPRData();
          
          const hasDebt = parseFloat(debt) > 0;
          
                      return (
              <div 
                key={pos.address || idx} 
                className="p-4 border-b last:border-b-0 transition-colors"
              >
              {/* Desktop layout - Collateral позиция */}
              <div className="hidden md:flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-8 h-8 relative cursor-help">
                          {collateralLogo && (
                            <Image 
                              src={collateralLogo} 
                              alt={collateralSymbol}
                              width={32}
                              height={32}
                              className="object-contain"
                            />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="w-[768px] p-4 bg-black text-white border-gray-700">
                        <div className="space-y-3">
                                                      <div className="font-semibold text-sm text-white">{collateralSymbol} Supply</div>
                          <div className="text-xs space-y-2 text-gray-200">
                            <div><span className="font-medium text-white">Position ID:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{pos.address}</code></div>
                            <div><span className="font-medium text-white">Pool ID:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{pos.poolAddress}</code></div>
                            <div><span className="font-medium text-white">Liquidation Price:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">${pos.liquidatePrice}</code></div>
                            {collateralAPRData.rewardPoolAddress && (
                              <div><span className="font-medium text-white">Reward Pool:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{collateralAPRData.rewardPoolAddress}</code></div>
                            )}
                          </div>
                          <div className="text-xs space-y-1 text-gray-200">
                            <div><span className="font-medium text-white">Supply APR:</span> {collateralAPRData.supplyApr.toFixed(2)}%</div>
                            <div><span className="font-medium text-white">Incentive APR:</span> {collateralAPRData.supplyIncentiveApr.toFixed(2)}%</div>
                            <div><span className="font-medium text-white">Staking APR:</span> {collateralAPRData.stakingApr.toFixed(2)}%</div>
                            <div className="border-t border-gray-600 pt-1 mt-1">
                              <span className="font-semibold text-white">Total APR: {collateralAPRData.totalApr.toFixed(2)}%</span>
                            </div>
                            {collateralAPRData.rewardPoolAddress && (
                              <div className="mt-2">
                                <span className="font-medium text-white">Reward Pool:</span>
                                <code className="bg-gray-800 px-1 rounded text-xs text-gray-100 block mt-1">{collateralAPRData.rewardPoolAddress}</code>
                              </div>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg">{collateralSymbol}</div>
                      <Badge 
                        variant="outline" 
                        className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5"
                      >
                                                  Supply
                      </Badge>
                    </div>
                    <div className="text-base text-muted-foreground mt-0.5">
                      ${collateralPrice}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs font-normal px-2 py-0.5 h-5 cursor-help",
                              collateralAPRData.totalApr > 0 
                                ? "bg-green-500/10 text-green-600 border-green-500/20"
                                : "bg-gray-500/10 text-gray-600 border-gray-500/20"
                            )}
                          >
                            APR: {collateralAPRData.totalApr.toFixed(2)}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="w-80 p-3 bg-black text-white border-gray-700">
                          <div className="space-y-2">
                            <div className="font-semibold text-sm text-white">APR Breakdown</div>
                            <div className="text-xs space-y-1 text-gray-200">
                              <div><span className="font-medium text-white">Supply APR:</span> {collateralAPRData.supplyApr.toFixed(2)}%</div>
                              <div><span className="font-medium text-white">Incentive APR:</span> {collateralAPRData.supplyIncentiveApr.toFixed(2)}%</div>
                              <div><span className="font-medium text-white">Staking APR:</span> {collateralAPRData.stakingApr.toFixed(2)}%</div>
                              <div className="border-t border-gray-600 pt-1 mt-1">
                                <span className="font-semibold text-white">Total APR: {collateralAPRData.totalApr.toFixed(2)}%</span>
                              </div>
                              {collateralAPRData.rewardPoolAddress && (
                                <div className="mt-2">
                                  <span className="font-medium text-white">Reward Pool:</span>
                                  <code className="bg-gray-800 px-1 rounded text-xs text-gray-100 block mt-1">{collateralAPRData.rewardPoolAddress}</code>
                                </div>
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="text-lg font-bold">${collateralValue}</div>
                  </div>
                  <div className="text-base text-muted-foreground font-semibold">
                    {parseFloat(collateral).toFixed(4)} {collateralSymbol}
                  </div>
                  
                  {/* Rewards section - прямо в карточке */}
                  {rewardsData[pos.address] && (
                    rewardsData[pos.address].collateral.length > 0 || 
                    (!hasDebt && rewardsData[pos.address].borrow.length > 0)
                  ) && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      {/* Collateral Rewards */}
                      {rewardsData[pos.address].collateral.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs font-medium text-gray-600 mb-1">💰 Supply Rewards</div>
                          <div className="space-y-1">
                            {rewardsData[pos.address].collateral.map((reward, rewardIdx) => {
                              if (!reward || !reward.key || !reward.value) return null;
                              const tokenInfo = getRewardTokenInfoHelper(reward.key);
                              if (!tokenInfo) return null;
                              const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                              const value = tokenInfo.price ? (amount * tokenInfo.price).toFixed(2) : 'N/A';
                              return (
                                <TooltipProvider key={rewardIdx}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center justify-between text-xs cursor-help">
                                        <div className="flex items-center gap-1">
                                        </div>
                                        <div className="text-right">
                                          {value !== 'N/A' ? (
                                            <div className="font-medium">${value}</div>
                                          ) : (
                                            <div className="font-medium">{amount.toFixed(4)}</div>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-black text-white border-gray-700">
                                      <div className="text-xs">
                                        <div className="text-gray-300">{amount.toFixed(6)} {tokenInfo.symbol}</div>
                                        {value !== 'N/A' && (
                                          <div className="text-gray-300">${value}</div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Borrow Rewards - показываем в collateral секции, если нет debt */}
                      {!hasDebt && rewardsData[pos.address].borrow.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1">💳 Borrow Rewards</div>
                          <div className="space-y-1">
                            {rewardsData[pos.address].borrow.map((reward, rewardIdx) => {
                              if (!reward || !reward.key || !reward.value) return null;
                              const tokenInfo = getRewardTokenInfoHelper(reward.key);
                              if (!tokenInfo) return null;
                              const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                              const value = tokenInfo.price ? (amount * tokenInfo.price).toFixed(2) : 'N/A';
                              return (
                                <TooltipProvider key={rewardIdx}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center justify-between text-xs cursor-help">
                                        <div className="flex items-center gap-1">
                                        </div>
                                        <div className="text-right">
                                          {value !== 'N/A' ? (
                                            <div className="font-medium">${value}</div>
                                          ) : (
                                            <div className="font-medium">{amount.toFixed(4)}</div>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-black text-white border-gray-700">
                                      <div className="text-xs">
                                        <div className="text-gray-300">{amount.toFixed(6)} {tokenInfo.symbol}</div>
                                        {value !== 'N/A' && (
                                          <div className="text-gray-300">${value}</div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile layout - Collateral позиция */}
              <div className="md:hidden space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {collateralLogo && (
                      <div className="w-8 h-8 relative">
                        <Image 
                          src={collateralLogo} 
                          alt={collateralSymbol}
                          width={32}
                          height={32}
                          className="object-contain"
                        />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <div className="text-lg">{collateralSymbol}</div>
                        <Badge 
                          variant="outline" 
                          className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5"
                        >
                          Supply
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${collateralPrice}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">${collateralValue}</div>
                    <div className="text-sm text-muted-foreground">
                      {parseFloat(collateral).toFixed(4)} {collateralSymbol}
                    </div>
                  </div>
                </div>

                {/* APR и ликвидационная цена */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs font-normal px-2 py-0.5 h-5",
                        collateralAPRData.totalApr > 0 
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : "bg-gray-500/10 text-gray-600 border-gray-500/20"
                      )}
                    >
                      APR: {collateralAPRData.totalApr.toFixed(2)}%
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Supply: {collateralAPRData.supplyApr.toFixed(2)}% | Incentive: {collateralAPRData.supplyIncentiveApr.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-xs text-red-600 font-medium">
                    Liquidation: ${pos.liquidatePrice}
                  </div>
                </div>

                {/* Rewards для мобильных */}
                {rewardsData[pos.address] && rewardsData[pos.address].collateral.length > 0 && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs font-medium text-gray-600 mb-1">💰 Supply Rewards</div>
                    <div className="space-y-1">
                      {rewardsData[pos.address].collateral.map((reward, rewardIdx) => {
                        if (!reward || !reward.key || !reward.value) return null;
                        const tokenInfo = getRewardTokenInfoHelper(reward.key);
                        if (!tokenInfo) return null;
                        const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                        const value = tokenInfo.price ? (amount * tokenInfo.price).toFixed(2) : 'N/A';
                        return (
                          <div key={rewardIdx} className="flex items-center justify-between text-xs">
                            <span>{amount.toFixed(4)} {tokenInfo.symbol}</span>
                            <span className="font-medium">{value !== 'N/A' ? `$${value}` : amount.toFixed(4)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Borrow Rewards для мобильных - если нет debt */}
                {!hasDebt && rewardsData[pos.address] && rewardsData[pos.address].borrow.length > 0 && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs font-medium text-gray-600 mb-1">💳 Borrow Rewards</div>
                    <div className="space-y-1">
                      {rewardsData[pos.address].borrow.map((reward, rewardIdx) => {
                        if (!reward || !reward.key || !reward.value) return null;
                        const tokenInfo = getRewardTokenInfoHelper(reward.key);
                        if (!tokenInfo) return null;
                        const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                        const value = tokenInfo.price ? (amount * tokenInfo.price).toFixed(2) : 'N/A';
                        return (
                          <div key={rewardIdx} className="flex items-center justify-between text-xs">
                            <span>{amount.toFixed(4)} {tokenInfo.symbol}</span>
                            <span className="font-medium">{value !== 'N/A' ? `$${value}` : amount.toFixed(4)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop layout - Debt позиция */}
              {hasDebt && (
                <div className="hidden md:flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-8 h-8 relative cursor-help">
                            {debtLogo && (
                              <Image 
                                src={debtLogo} 
                                alt={debtSymbol}
                                width={32}
                                height={32}
                                className="object-contain"
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="w-[768px] p-4 bg-black text-white border-gray-700">
                          <div className="space-y-3">
                            <div className="font-semibold text-sm text-white">{debtSymbol} Borrow</div>
                            <div className="text-xs space-y-2 text-gray-200">
                              <div><span className="font-medium text-white">Position ID:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{pos.address}</code></div>
                              <div><span className="font-medium text-white">Pool ID:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{pos.poolAddress}</code></div>
                              <div><span className="font-medium text-white">Liquidation Price:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">${pos.liquidatePrice}</code></div>
                              {debtAPRData.rewardPoolAddress && (
                                <div><span className="font-medium text-white">Reward Pool:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{debtAPRData.rewardPoolAddress}</code></div>
                              )}
                            </div>

                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-lg">{debtSymbol}</div>
                        <Badge 
                          variant="outline" 
                          className="bg-red-500/10 text-red-600 border-red-500/20 text-xs font-normal px-2 py-0.5 h-5"
                        >
                          Borrow
                        </Badge>
                      </div>
                      <div className="text-base text-muted-foreground mt-0.5">
                        ${debtPrice}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs font-normal px-2 py-0.5 h-5 cursor-help",
                                debtAPRData.totalApr > 0 
                                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                                  : "bg-red-500/10 text-red-600 border-red-500/20"
                              )}
                            >
                              APR: {debtAPRData.totalApr.toFixed(2)}%
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="w-80 p-3 bg-black text-white border-gray-700">
                            <div className="space-y-2">
                              <div className="font-semibold text-sm text-white">APR Breakdown</div>
                              <div className="text-xs space-y-1 text-gray-200">
                                <div><span className="font-medium text-white">Borrow APR:</span> -{debtAPRData.borrowApr.toFixed(2)}%</div>
                                <div><span className="font-medium text-white">Incentive APR:</span> +{debtAPRData.borrowIncentiveApr.toFixed(2)}%</div>
                                <div className="border-t border-gray-600 pt-1 mt-1">
                                  <span className="font-semibold text-white">Net APR: {debtAPRData.totalApr.toFixed(2)}%</span>
                                </div>
                                {debtAPRData.rewardPoolAddress && (
                                  <div className="mt-2">
                                    <span className="font-medium text-white">Reward Pool:</span>
                                    <code className="bg-gray-800 px-1 rounded text-xs text-gray-100 block mt-1">{debtAPRData.rewardPoolAddress}</code>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <div className="text-lg font-bold text-red-600">-${debtValue}</div>
                    </div>
                    <div className="text-base text-muted-foreground font-semibold">
                      {parseFloat(debt).toFixed(4)} {debtSymbol}
                    </div>
                    
                    {/* Rewards section для debt позиции */}
                    {rewardsData[pos.address] && rewardsData[pos.address].borrow.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        {/* Borrow Rewards для debt позиции */}
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1">💳 Borrow Rewards</div>
                          <div className="space-y-1">
                            {rewardsData[pos.address].borrow.map((reward, rewardIdx) => {
                              if (!reward || !reward.key || !reward.value) return null;
                              const tokenInfo = getRewardTokenInfoHelper(reward.key);
                              if (!tokenInfo) return null;
                              const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                              const value = tokenInfo.price ? (amount * tokenInfo.price).toFixed(2) : 'N/A';
                              return (
                                <TooltipProvider key={rewardIdx}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center justify-between text-xs cursor-help">
                                        <div className="flex items-center gap-1">
                                        </div>
                                        <div className="text-right">
                                          {value !== 'N/A' ? (
                                            <div className="font-medium">${value}</div>
                                          ) : (
                                            <div className="font-medium">{amount.toFixed(4)}</div>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-black text-white border-gray-700">
                                      <div className="text-xs">
                                        <div className="text-gray-300">{amount.toFixed(6)} {tokenInfo.symbol}</div>
                                        {value !== 'N/A' && (
                                          <div className="text-gray-300">${value}</div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mobile layout - Debt позиция */}
              {hasDebt && (
                <div className="md:hidden space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {debtLogo && (
                        <div className="w-8 h-8 relative">
                          <Image 
                            src={debtLogo} 
                            alt={debtSymbol}
                            width={32}
                            height={32}
                            className="object-contain"
                          />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className="text-lg">{debtSymbol}</div>
                          <Badge 
                            variant="outline" 
                            className="bg-red-500/10 text-red-600 border-red-500/20 text-xs font-normal px-2 py-0.5 h-5"
                          >
                            Borrow
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ${debtPrice}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">-${debtValue}</div>
                      <div className="text-sm text-muted-foreground">
                        {parseFloat(debt).toFixed(4)} {debtSymbol}
                      </div>
                    </div>
                  </div>

                  {/* APR и ликвидационная цена */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs font-normal px-2 py-0.5 h-5",
                          debtAPRData.totalApr > 0 
                            ? "bg-green-500/10 text-green-600 border-green-500/20"
                            : "bg-red-500/10 text-red-600 border-red-500/20"
                        )}
                      >
                        APR: {debtAPRData.totalApr.toFixed(2)}%
                      </Badge>
                      <span className="text-xs text-gray-500">
                        Borrow: -{debtAPRData.borrowApr.toFixed(2)}% | Incentive: +{debtAPRData.borrowIncentiveApr.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-xs text-red-600 font-medium">
                      Liquidation: ${pos.liquidatePrice}
                    </div>
                  </div>

                  {/* Rewards для мобильных */}
                  {rewardsData[pos.address] && rewardsData[pos.address].borrow.length > 0 && (
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-xs font-medium text-gray-600 mb-1">💳 Borrow Rewards</div>
                      <div className="space-y-1">
                        {rewardsData[pos.address].borrow.map((reward, rewardIdx) => {
                          if (!reward || !reward.key || !reward.value) return null;
                          const tokenInfo = getRewardTokenInfoHelper(reward.key);
                          if (!tokenInfo) return null;
                          const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                          const value = tokenInfo.price ? (amount * tokenInfo.price).toFixed(2) : 'N/A';
                          return (
                            <div key={rewardIdx} className="flex items-center justify-between text-xs">
                              <span>{amount.toFixed(4)} {tokenInfo.symbol}</span>
                              <span className="font-medium">{value !== 'N/A' ? `$${value}` : amount.toFixed(4)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </ScrollArea>
      
      {/* Desktop layout - Total Assets */}
      <div className="hidden md:flex items-center justify-between pt-6 pb-6">
        <span className="text-xl">Total assets in Auro Finance:</span>
        <div className="text-right">
          <span className="text-xl text-primary font-bold">${totalValue.toFixed(2)}</span>
          {totalRewardsValue > 0 && (
            <div className="text-sm text-muted-foreground mt-1 flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <span>💰</span>
                <span>including rewards ${totalRewardsValue.toFixed(2)}</span>
              </div>
              {totalClaimableRewards > 0 && (
                <button
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold disabled:opacity-60"
                  onClick={handleClaimAllRewards}
                  disabled={isClaiming || totalClaimableRewards === 0}
                >
                  {isClaiming ? 'Claiming...' : `Claim rewards`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout - Total Assets */}
      <div className="md:hidden pt-6 pb-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg">Total assets in Auro Finance:</span>
          <span className="text-lg text-primary font-bold">${totalValue.toFixed(2)}</span>
        </div>
        {totalRewardsValue > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <span>💰</span>
              <span>including rewards ${totalRewardsValue.toFixed(2)}</span>
            </div>
            {totalClaimableRewards > 0 && (
              <button
                className="w-full py-2 bg-green-600 text-white rounded text-sm font-semibold disabled:opacity-60"
                onClick={handleClaimAllRewards}
                disabled={isClaiming || totalClaimableRewards === 0}
              >
                {isClaiming ? 'Claiming...' : `Claim rewards`}
              </button>
            )}
          </div>
        )}
      </div>



    </div>
  );
} 