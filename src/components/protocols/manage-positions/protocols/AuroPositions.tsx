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
  const [rewardsData, setRewardsData] = useState<any[]>([]);

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
        
        // Собираем адреса позиций и пулов наград
        const positionsAddress = positions.map(pos => pos.address).filter(Boolean);
        const rewardPoolsAddress = poolsData
          .map(pool => pool.rewardPoolAddress)
          .filter(Boolean);

        console.log('Positions addresses:', positionsAddress);
        console.log('Reward pools addresses:', rewardPoolsAddress);

        if (positionsAddress.length === 0 || rewardPoolsAddress.length === 0) {
          console.log('No positions or reward pools found');
          return;
        }

        const requestBody = {
          positionsAddress,
          rewardPoolsAddress
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
          
          if (data.success && Array.isArray(data.data)) {
            setRewardsData(data.data);
            console.log('Set rewards data:', data.data);
          } else {
            console.log('Invalid rewards response format:', data);
            setRewardsData([]);
          }
        } else {
          const errorText = await response.text();
          console.error('Rewards API error:', response.status, errorText);
          setRewardsData([]);
        }
      } catch (error) {
        console.error('Error loading rewards:', error);
        setRewardsData([]);
      }
    };

    fetchRewards();
  }, [positions, poolsData]);

  // Сортировка по value (по убыванию)
  const sortedPositions = [...positions].sort((a, b) => {
    const valueA = a.collateralTokenInfo?.usdPrice ? parseFloat(a.collateralAmount) * parseFloat(a.collateralTokenInfo.usdPrice) : 0;
    const valueB = b.collateralTokenInfo?.usdPrice ? parseFloat(b.collateralAmount) * parseFloat(b.collateralTokenInfo.usdPrice) : 0;
    return valueB - valueA;
  });

  // Сумма активов
  useEffect(() => {
    const total = sortedPositions.reduce((sum, pos) => {
      const collateralValue = pos.collateralTokenInfo?.usdPrice ? parseFloat(pos.collateralAmount) * parseFloat(pos.collateralTokenInfo.usdPrice) : 0;
      const debtValue = pos.debtTokenInfo?.usdPrice ? parseFloat(pos.debtAmount) * parseFloat(pos.debtTokenInfo.usdPrice) : 0;
      return sum + collateralValue - debtValue;
    }, 0);
    setTotalValue(total);
    
    if (onPositionsValueChange) {
      onPositionsValueChange(total);
    }
  }, [sortedPositions, onPositionsValueChange]);

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

  // Получение информации о токене награды
  const getRewardTokenInfo = (tokenAddress: string) => {
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

  // Получение наград для позиции
  const getPositionRewards = (positionAddress: string) => {
    return rewardsData.filter(reward => 
      reward.key && reward.value && parseFloat(reward.value) > 0
    );
  };

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
              {/* Collateral позиция */}
              <div className="flex justify-between items-center mb-3">
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
                            <div className="font-semibold text-sm text-white">{collateralSymbol} Collateral</div>
                            <div className="text-xs space-y-2 text-gray-200">
                              <div><span className="font-medium text-white">Position ID:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{pos.address}</code></div>
                              <div><span className="font-medium text-white">Pool ID:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{pos.poolAddress}</code></div>
                              <div><span className="font-medium text-white">Token Address:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{pos.collateralTokenAddress}</code></div>
                              {collateralAPRData.rewardPoolAddress && (
                                <div><span className="font-medium text-white">Reward Pool:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{collateralAPRData.rewardPoolAddress}</code></div>
                              )}
                            </div>
                            {/* Rewards section */}
                            {rewardsData && rewardsData.length > 0 && (
                              <div className="border-t border-gray-600 pt-3 mt-3">
                                <div className="font-semibold text-sm text-white mb-2">🎁 Claimable Rewards</div>
                                <div className="space-y-2">
                                  {rewardsData.map((reward, rewardIdx) => {
                                    if (!reward || !reward.key || !reward.value) return null;
                                    const tokenInfo = getRewardTokenInfo(reward.key);
                                    if (!tokenInfo) return null;
                                    const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                                    const value = tokenInfo.price ? (amount * tokenInfo.price).toFixed(2) : 'N/A';
                                    return (
                                      <div key={rewardIdx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          {tokenInfo.icon_uri && (
                                            <img src={tokenInfo.icon_uri} alt={tokenInfo.symbol} className="w-4 h-4 rounded-full" />
                                          )}
                                          <span className="text-white font-medium">{tokenInfo.symbol}</span>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-white font-semibold">{amount.toFixed(6)}</div>
                                          {value !== 'N/A' && (
                                            <div className="text-gray-300 text-xs">${value}</div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
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
                        Collateral
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
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5 cursor-help">
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
                </div>
              </div>

              {/* Debt позиция - если есть */}
              {hasDebt && (
                <div className="flex justify-between items-center">
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
                            <div className="font-semibold text-sm text-white">{debtSymbol} Debt</div>
                            <div className="text-xs space-y-2 text-gray-200">
                              <div><span className="font-medium text-white">Position ID:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{pos.address}</code></div>
                              <div><span className="font-medium text-white">Pool ID:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{pos.poolAddress}</code></div>
                              <div><span className="font-medium text-white">Liquidation Price:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">${pos.liquidatePrice}</code></div>
                              {debtAPRData.rewardPoolAddress && (
                                <div><span className="font-medium text-white">Reward Pool:</span> <code className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-100 block mt-1">{debtAPRData.rewardPoolAddress}</code></div>
                              )}
                            </div>
                            {/* Rewards section */}
                            {rewardsData && rewardsData.length > 0 && (
                              <div className="border-t border-gray-600 pt-3 mt-3">
                                <div className="font-semibold text-sm text-white mb-2">🎁 Claimable Rewards</div>
                                <div className="space-y-2">
                                  {rewardsData.map((reward, rewardIdx) => {
                                    if (!reward || !reward.key || !reward.value) return null;
                                    const tokenInfo = getRewardTokenInfo(reward.key);
                                    if (!tokenInfo) return null;
                                    
                                    const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                                    const value = tokenInfo.price ? (amount * tokenInfo.price).toFixed(2) : 'N/A';
                                    
                                    return (
                                      <div key={rewardIdx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          {tokenInfo.icon_uri && (
                                            <img src={tokenInfo.icon_uri} alt={tokenInfo.symbol} className="w-4 h-4 rounded-full" />
                                          )}
                                          <span className="text-white font-medium">{tokenInfo.symbol}</span>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-white font-semibold">{amount.toFixed(6)}</div>
                                          {value !== 'N/A' && (
                                            <div className="text-gray-300 text-xs">${value}</div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
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
                          Debt
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
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </ScrollArea>
      
      <div className="flex items-center justify-between pt-6 pb-6">
        <span className="text-xl">Total assets in Auro Finance:</span>
        <span className="text-xl text-primary font-bold">${totalValue.toFixed(2)}</span>
      </div>

      {/* Кнопка Manage Positions */}
      {protocol && <ManagePositionsButton protocol={protocol} />}
    </div>
  );
} 