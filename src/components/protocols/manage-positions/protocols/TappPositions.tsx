'use client';

import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat";

interface TappPositionProps {
  position: any;
  index: number;
}

function formatCurrencyValue(value: number) {
  if (value === 0) {
    return '$0.00';
  }
  if (value > 0 && value < 0.01) {
    return '< $0.01';
  }
  return formatCurrency(value);
}

function TappPosition({ position, index }: TappPositionProps) {
  const token0 = position.estimatedWithdrawals?.[0];
  const token1 = position.estimatedWithdrawals?.[1];
  const tokens = (position.estimatedWithdrawals || []).slice(0, 3);

  if (!token0 || !token1) {
    return null;
  }

  const token0Amount = parseFloat(token0.amount || '0');
  const token1Amount = parseFloat(token1.amount || '0');

  const token0Value = parseFloat(token0.usd || "0");
  const token1Value = parseFloat(token1.usd || "0");

  // Build unified entries for up to three tokens
  const tokenEntries = tokens.map((t: any) => ({
    symbol: t.symbol,
    amount: parseFloat(t.amount || '0'),
    value: parseFloat(t.usd || '0'),
  }));

  // Position value is the sum across all displayed tokens (up to three)
  const positionValue = tokenEntries.reduce(
    (sum: number, t: { symbol: string; amount: number; value: number }) => sum + t.value,
    0
  );

  // Считаем только rewards (стимулы)
  const rewardsValue = (position.estimatedIncentives || []).reduce((sum: number, r: any) => sum + parseFloat(r.usd || "0"), 0);
  // IMPORTANT: Do NOT add rewards to the displayed total
  const displayedTotal = positionValue;

  const rewards = (position.estimatedIncentives || []).map((r: any) => {
    const amount = parseFloat(r.amount || "0");
    return { ...r, amount };
  });

  const fees = (position.totalEarnings || []).map((fee: any) => {
    const amount = parseFloat(fee.amount || "0");
    return { ...fee, amount };
  });

  const totalApr = parseFloat(position.apr?.totalAprPercentage || '0');
  const feeApr = parseFloat(position.apr?.feeAprPercentage || '0');
  const boostedApr = parseFloat(position.apr?.boostedAprPercentage || '0');

  return (
    <div key={`${position.positionAddr}-${index}`} className="mt-2 pb-2 border-b last:border-b-0">
	 <div className="flex flex-wrap justify-between items-center mb-2">
		<div className="flex items-center gap-2">
          {tokens.length > 0 && (
            <div className="flex -space-x-2 mr-2">
              {tokens.map((t: any, i: number) => (
                <img key={i} src={t.img} alt={t.symbol} className="w-8 h-8 rounded-full border-2 border-white object-contain" />
              ))}
            </div>
          )}
          <span className="text-lg font-semibold">{tokens.map((t: any) => t.symbol).join(' / ')}</span>
          <span className="px-2 py-1 rounded bg-green-500/10 text-green-600 text-xs font-semibold ml-2">Active</span>
        </div>
        <div className="flex items-centern gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-2 py-0.5 h-5 cursor-help mt-1">
                  APR: {formatNumber(totalApr, 2)}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">APR Breakdown</p>
                  <p className="text-xs">Fee APR: {formatNumber(feeApr, 2)}%</p>
                  <p className="text-xs">Boosted APR: {formatNumber(boostedApr, 2)}%</p>
                  <p className="text-xs font-semibold">Total APR: {formatNumber(totalApr, 2)}%</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-lg font-bold">{formatCurrencyValue(displayedTotal)}</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-between items-start">
		<div className={`grid ${tokens.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-x-6 gap-y-2 text-sm`}>
          {tokenEntries.map((te: { symbol: string; amount: number; value: number }) => (
            <div key={`amt-${te.symbol}`}>
              <div className="text-gray-500">{te.symbol} Amount</div>
              <div className="font-medium">{formatNumber(te.amount, 6)}</div>
            </div>
          ))}
          {tokenEntries.map((te: { symbol: string; amount: number; value: number }) => (
            <div key={`val-${te.symbol}`}>
              <div className="text-gray-500">{te.symbol} Value</div>
              <div className="font-medium">{formatCurrencyValue(te.value)}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-end gap-2 text-sm">
          {rewards.length > 0 && (
            <div className="mt-2 text-right">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-gray-500 mb-1 cursor-help">🎁 Rewards: {formatCurrency(rewardsValue)}</div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1 text-xs max-h-48 overflow-auto">
                      {rewards.map((reward: any, rewardIndex: number) => (
                        <div key={rewardIndex} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {reward.img && (
                              <img src={reward.img} alt={reward.symbol} className="w-4 h-4 rounded-full" />
                            )}
                            <span>{reward.symbol}</span>
                          </div>
                          <span className="font-semibold">{formatNumber(reward.amount, 6)}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TappPositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPositions = async () => {
    if (!account?.address) {
      setPositions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/protocols/tapp/userPositions?address=${account.address}`);
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const rawData = await response.json();
      
      if (rawData.success && Array.isArray(rawData.data)) {
        const sortedPositions = [...rawData.data].sort((a, b) => {
          const aValue = (a.estimatedWithdrawals || []).reduce((sum: number, token: any) => sum + parseFloat(token.usd || "0"), 0);
          const bValue = (b.estimatedWithdrawals || []).reduce((sum: number, token: any) => sum + parseFloat(token.usd || "0"), 0);
          return bValue - aValue;
        });
        setPositions(sortedPositions);
      } else {
        setPositions([]);
      }
    } catch (err) {
      console.error('Error loading Tapp positions:', err);
      setError('Failed to load positions');
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPositions();

    const handleRefresh = async (event: CustomEvent) => {
      if (event.detail.protocol === 'tapp') {
        if (event.detail.data && Array.isArray(event.detail.data)) {
          const sortedPositions = [...event.detail.data].sort((a, b) => {
              const aValue = (a.estimatedWithdrawals || []).reduce((sum: number, token: any) => sum + parseFloat(token.usd || "0"), 0);
              const bValue = (b.estimatedWithdrawals || []).reduce((sum: number, token: any) => sum + parseFloat(token.usd || "0"), 0);
              return bValue - aValue;
          });
          setPositions(sortedPositions);
        } else {
          // Если данных нет, загружаем позиции заново
          await loadPositions();
        }
      }
    };

    window.addEventListener('refreshPositions', handleRefresh as unknown as EventListener);
    return () => {
      window.removeEventListener('refreshPositions', handleRefresh as unknown as EventListener);
    };
  }, [account?.address]);

  const totalValue = positions.reduce((sum, position) => {
    const positionValue = (position.estimatedWithdrawals || []).reduce((tokenSum: number, token: any) => {
      return tokenSum + parseFloat(token.usd || "0");
    }, 0);
    const incentivesValue = (position.estimatedIncentives || []).reduce((incentiveSum: number, incentive: any) => {
      return incentiveSum + parseFloat(incentive.usd || "0");
    }, 0);
    return sum + positionValue + incentivesValue;
  }, 0);
  
  const totalRewards = positions.reduce((sum, position) => {
    const incentivesValue = (position.estimatedIncentives || []).reduce((incentiveSum: number, incentive: any) => {
      return incentiveSum + parseFloat(incentive.usd || "0");
    }, 0);
    return sum + incentivesValue;
  }, 0);

  if (loading) {
    return <div className="p-4 text-left">Loading positions...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500 text-center">Error: {error}</div>;
  }

  if (positions.length === 0) {
    return <div className="p-4 text-center text-gray-500">No Tapp positions found</div>;
  }

  return (
    <div className="w-full mb-6 py-2">
      <div className="space-y-4 text-base">
        {positions.map((position, index) => (
          <TappPosition key={`${position.positionAddr}-${index}`} position={position} index={index} />
        ))}
        <div className="pt-6 pb-6">
         
		 {/* Desktop layout */}
          <div className="hidden md:block">
            <div className="flex items-center justify-between">
              <span className="text-xl">Total assets in Tapp Exchange:</span>
              <span className="text-xl text-primary font-bold">{formatCurrency(totalValue)}</span>
            </div>
            {totalRewards > 0 && (
              <div className="flex justify-end mt-2">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                    <span>💰</span>
                    <span>including rewards {formatCurrency(totalRewards)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Mobile layout */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-lg">Total assets in Tapp Exchange:</span>
              <span className="text-lg text-primary font-bold">{formatCurrency(totalValue)}</span>
            </div>
            {totalRewards > 0 && (
               <div className="space-y-2">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <span>💰</span>
                  <span>including rewards ${totalRewards.toFixed(2)}</span>
                </div>
              </div>
            )}
   		  </div>
        </div>
      </div>
    </div>
  );
} 