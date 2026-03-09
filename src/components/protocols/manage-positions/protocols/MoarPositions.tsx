import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { useClaimRewards } from '@/lib/hooks/useClaimRewards';
import { useWithdraw } from '@/lib/hooks/useWithdraw';
import { useToast } from '@/components/ui/use-toast';
import { useWalletStore } from '@/lib/stores/walletStore';
import { queryKeys } from '@/lib/query/queryKeys';
import { useMoarPositions, useMoarRewards, useMoarPools, type MoarPosition } from '@/lib/query/hooks/protocols/moar';
import { WithdrawModal } from '@/components/ui/withdraw-modal';
import { DepositModal } from '@/components/ui/deposit-modal';
import { ClaimSuccessModal } from '@/components/ui/claim-success-modal';
import { formatNumber, formatCurrency } from '@/lib/utils/numberFormat';

interface MoarPositionsProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

export function MoarPositions({ address, onPositionsValueChange }: MoarPositionsProps) {
  const { account } = useWallet();
  const queryClient = useQueryClient();
  const walletAddress = address || account?.address?.toString();
  const { claimRewards, isLoading: isClaiming } = useClaimRewards();
  const { withdraw, isLoading: isWithdrawing } = useWithdraw();
  const { toast } = useToast();
  const { setRewards, getTokenPrice } = useWalletStore();

  const { data: positions = [], isLoading: positionsLoading, error: positionsError } = useMoarPositions(walletAddress, {
    refetchOnMount: 'always',
  });
  const { data: rewardsResponse, isLoading: rewardsLoading } = useMoarRewards(walletAddress, {
    refetchOnMount: 'always',
  });
  const { data: poolsResponse } = useMoarPools();

  const rewardsData = rewardsResponse?.data ?? [];
  const totalRewardsValue = rewardsResponse?.totalUsd ?? 0;
  const totalValue = useMemo(
    () => positions.reduce((sum, p) => sum + parseFloat(p.value || "0"), 0),
    [positions]
  );
  const loading = positionsLoading || rewardsLoading;
  const error = positionsError ? "Failed to load Moar Market data" : null;

  const poolsAPR = useMemo(() => {
    if (!poolsResponse?.data) return {} as Record<number, { totalAPR: number; interestRateComponent: number; farmingAPY: number }>;
    const map: Record<number, { totalAPR: number; interestRateComponent: number; farmingAPY: number }> = {};
    poolsResponse.data.forEach((pool: { poolId?: number; totalAPY?: number; interestRateComponent?: number; farmingAPY?: number }) => {
      if (pool.poolId !== undefined) {
        map[pool.poolId] = {
          totalAPR: pool.totalAPY ?? 0,
          interestRateComponent: pool.interestRateComponent ?? 0,
          farmingAPY: pool.farmingAPY ?? 0,
        };
      }
    });
    return map;
  }, [poolsResponse?.data]);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<MoarPosition | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedDepositPosition, setSelectedDepositPosition] = useState<MoarPosition | null>(null);
  const [showClaimSuccessModal, setShowClaimSuccessModal] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<any[]>([]);
  const [claimTransactionHash, setClaimTransactionHash] = useState<string>('');
  const isModalOpeningRef = useRef(false);

  useEffect(() => {
    if (rewardsData.length > 0) {
      setRewards("moar", rewardsData);
    } else if (!rewardsLoading && walletAddress) {
      setRewards("moar", []);
    }
  }, [rewardsData, rewardsLoading, walletAddress, setRewards]);

  useEffect(() => {
    onPositionsValueChange?.(totalValue + totalRewardsValue);
  }, [totalValue, totalRewardsValue, onPositionsValueChange]);

  const handleWithdrawClick = (position: MoarPosition) => {
    setSelectedPosition(position);
    setShowWithdrawModal(true);
  };

  const handleDepositClick = (position: MoarPosition) => {
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

      await withdraw('moar', String(selectedPosition.poolId), amount, tokenAddress);

      // Закрываем модал и обновляем состояние
      setShowWithdrawModal(false);
      setSelectedPosition(null);

      // Invalidate TanStack Query cache so Sidebar/Portfolio Moar card refetches
      if (walletAddress) {
        queryClient.invalidateQueries({ queryKey: queryKeys.protocols.moar.userPositions(walletAddress) });
        queryClient.invalidateQueries({ queryKey: queryKeys.protocols.moar.rewards(walletAddress) });
      }
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshPositions', { detail: { protocol: 'moar' } }));
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
      // Save claimable amounts before claiming
      const rewardsToClaim: any[] = [];
      rewardsData.forEach((reward: any) => {
        if (reward.farming_identifier && reward.reward_id && reward.claimable_amount) {
          rewardsToClaim.push({
            farming_identifier: reward.farming_identifier,
            reward_id: reward.reward_id,
            symbol: reward.symbol,
            amount: reward.amount,
            usdValue: reward.usdValue,
            logoUrl: reward.logoUrl || reward.token_info?.logoUrl,
            tokenAddress: reward.tokenAddress, // Add tokenAddress for aggregation
            claimable_amount: reward.claimable_amount,
            decimals: reward.decimals || reward.token_info?.decimals || 8
          });
        }
      });

      // Group rewards by farming_identifier to avoid duplicate calls
      const rewardsByPool = new Map();
      rewardsToClaim.forEach((reward: any) => {
        if (reward.farming_identifier && reward.reward_id) {
          if (!rewardsByPool.has(reward.farming_identifier)) {
            rewardsByPool.set(reward.farming_identifier, []);
          }
          rewardsByPool.get(reward.farming_identifier).push(reward.reward_id);
        }
      });

      let lastTransactionHash = '';
      const claimedRewardsList: any[] = [];

      // Claim rewards for each pool
      for (const [farmingIdentifier, rewardIds] of rewardsByPool) {
        console.log(`Claiming rewards for pool ${farmingIdentifier}:`, rewardIds);

        // Find rewards that match this pool
        const poolRewards = rewardsToClaim.filter(
          (r) => r.farming_identifier === farmingIdentifier && rewardIds.includes(r.reward_id)
        );

        const result = await claimRewards('moar', [farmingIdentifier], rewardIds);

        // Extract transaction hash if available
        if (result && result.hash) {
          lastTransactionHash = result.hash;
        }

        // Add claimed rewards to list
        poolRewards.forEach((reward) => {
          claimedRewardsList.push({
            symbol: reward.symbol,
            amount: reward.amount,
            usdValue: reward.usdValue,
            logoUrl: reward.logoUrl,
            tokenAddress: reward.tokenAddress // Add tokenAddress for aggregation
          });
        });

        // Small delay between claims to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Aggregate rewards by tokenAddress (sum same tokens)
      // Normalize address for grouping: Move addresses (with ::) stay as-is, regular addresses are normalized
      const normalizeKey = (addr: string | undefined, symbol: string): string => {
        if (!addr) return symbol.toLowerCase();
        // For Move addresses (e.g., "0x1::aptos_coin::AptosCoin"), use as-is
        if (addr.includes('::')) return addr.toLowerCase();
        // For regular addresses, normalize by removing leading zeros
        if (addr.startsWith('0x')) {
          const normalized = '0x' + addr.slice(2).replace(/^0+/, '');
          return (normalized === '0x' ? '0x0' : normalized).toLowerCase();
        }
        return addr.toLowerCase();
      };

      const aggregatedRewards = claimedRewardsList.reduce((acc, reward) => {
        // Use normalized tokenAddress as key, fallback to symbol if tokenAddress is missing
        const key = normalizeKey(reward.tokenAddress, reward.symbol);

        if (!acc[key]) {
          acc[key] = {
            symbol: reward.symbol,
            amount: 0,
            usdValue: 0,
            logoUrl: reward.logoUrl,
            tokenAddress: reward.tokenAddress
          };
        }

        acc[key].amount += reward.amount || 0;
        acc[key].usdValue += reward.usdValue || 0;

        return acc;
      }, {} as Record<string, { symbol: string; amount: number; usdValue: number; logoUrl?: string | null; tokenAddress?: string }>);

      // Convert aggregated object to array
      const aggregatedRewardsArray = Object.values(aggregatedRewards);

      // Set rewards data first
      setClaimedRewards(aggregatedRewardsArray);
      setClaimTransactionHash(lastTransactionHash);

      // Mark that modal is opening to protect from re-renders
      isModalOpeningRef.current = true;

      // Show success modal with aggregated rewards after delay (to let toast appear first)
      setTimeout(() => {
        setShowClaimSuccessModal(true);
      }, 250);

      if (walletAddress) {
        queryClient.invalidateQueries({ queryKey: queryKeys.protocols.moar.userPositions(walletAddress) });
        queryClient.invalidateQueries({ queryKey: queryKeys.protocols.moar.rewards(walletAddress) });
      }
    } catch (error) {
      console.error('Error claiming all rewards:', error);
      // Reset ref on error
      isModalOpeningRef.current = false;
      toast({
        title: "Error",
        description: "Failed to claim rewards. Please try again.",
        variant: "destructive"
      });
    }
  };


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

  useEffect(() => {
    const handleRefresh = (event: CustomEvent) => {
      if (isModalOpeningRef.current || showClaimSuccessModal) return;
      if (event.detail?.protocol === 'moar' && walletAddress) {
        queryClient.invalidateQueries({ queryKey: queryKeys.protocols.moar.userPositions(walletAddress) });
        queryClient.invalidateQueries({ queryKey: queryKeys.protocols.moar.rewards(walletAddress) });
        queryClient.invalidateQueries({ queryKey: queryKeys.protocols.moar.pools() });
      }
    };
    window.addEventListener('refreshPositions', handleRefresh as unknown as EventListener);
    return () => window.removeEventListener('refreshPositions', handleRefresh as unknown as EventListener);
  }, [walletAddress, queryClient, showClaimSuccessModal]);

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
          const poolId = position.poolId;
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
            market: String(selectedPosition.poolId)
          }}
          tokenInfo={{
            symbol: selectedPosition.assetInfo.symbol,
            logoUrl: selectedPosition.assetInfo.logoUrl ?? undefined,
            decimals: selectedPosition.assetInfo.decimals
          }}
          isLoading={isWithdrawing}
          userAddress={walletAddress != null ? String(walletAddress) : undefined}
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
              const poolId = selectedDepositPosition.poolId;
              const poolAPR = poolsAPR[poolId];
              return poolAPR ? poolAPR.totalAPR : 0;
            })(),
            key: "moar" as any
          }}
          tokenIn={{
            symbol: selectedDepositPosition.assetInfo.symbol,
            logo: selectedDepositPosition.assetInfo.logoUrl ?? '',
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
            logo: selectedDepositPosition.assetInfo.logoUrl ?? '',
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
          priceUSD={(() => {
            const tokenAddress = (() => {
              if (selectedDepositPosition.assetInfo.symbol === 'APT') {
                return '0x1::aptos_coin::AptosCoin';
              } else if (selectedDepositPosition.assetInfo.symbol === 'USDC') {
                return '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b';
              }
              return selectedDepositPosition.assetInfo.symbol;
            })();
            return parseFloat(getTokenPrice(tokenAddress)) || 0;
          })()}
        />
      )}

      {/* Claim Success Modal */}
      <ClaimSuccessModal
        isOpen={showClaimSuccessModal}
        onClose={() => {
          setShowClaimSuccessModal(false);
          setClaimedRewards([]);
          setClaimTransactionHash('');
          // Reset ref when modal closes
          isModalOpeningRef.current = false;
        }}
        transactionHash={claimTransactionHash}
        rewards={claimedRewards}
        protocolName="Moar Market"
      />
    </div>
  );
}
