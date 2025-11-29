"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useCollapsible } from '@/contexts/CollapsibleContext';
import { ManagePositionsButton } from '../ManagePositionsButton';
import { getProtocolByName } from '@/lib/protocols/getProtocolsList';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useWalletStore } from '@/lib/stores/walletStore';
import { formatNumber, formatCurrency } from '@/lib/utils/numberFormat';

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
}

interface MoarPosition {
  poolId: number;
  assetName: string;
  balance: string;
  value: string;
  type: 'deposit';
  assetInfo: {
    symbol: string;
    logoUrl: string | null;
    decimals: number;
    name: string;
  };
}

export function PositionsList({ 
  address, 
  onPositionsValueChange, 
  refreshKey,
  onPositionsCheckComplete,
  showManageButton = true 
}: PositionsListProps) {
  const [positions, setPositions] = useState<MoarPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [rewardsData, setRewardsData] = useState<any>(null);
  const [totalRewardsValue, setTotalRewardsValue] = useState<number>(0);
  const { isExpanded, toggleSection } = useCollapsible();
  const { setRewards } = useWalletStore();
  const protocol = getProtocolByName("Moar Market");

  useEffect(() => {
    if (address) {
      fetchPositions();
      fetchRewards();
    }
  }, [address, refreshKey]);

  const fetchRewards = async () => {
    if (!address) return;
    
    try {
      console.log('🔍 Fetching Moar Market rewards for address:', address);
      const response = await fetch(`/api/protocols/moar/rewards?address=${address}`);
      const data = await response.json();
      
      if (data.success) {
        setRewardsData(data);
        setTotalRewardsValue(data.totalUsd || 0);
        
        // Сохраняем rewards в store для общего claim all
        if (data.data && Array.isArray(data.data)) {
          console.log('[MoarPositionsList] Saving rewards to store:', data.data);
          setRewards('moar', data.data);
        }
        
        console.log('💰 Rewards loaded:', data);
      } else {
        console.warn('💰 Failed to load rewards:', data.error);
        setRewardsData(null);
        setRewards('moar', []); // Очищаем store при ошибке
        setTotalRewardsValue(0);
      }
    } catch (error) {
      console.error('💰 Error fetching rewards:', error);
      setRewardsData(null);
      setRewards('moar', []); // Очищаем store при ошибке
      setTotalRewardsValue(0);
    }
  };

  // Update total value when rewards change
  useEffect(() => {
    if (onPositionsValueChange) {
      const totalWithRewards = totalValue + totalRewardsValue;
      onPositionsValueChange(totalWithRewards);
    }
  }, [onPositionsValueChange, totalValue, totalRewardsValue]);

  const fetchPositions = async () => {
    if (!address) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/protocols/moar/userPositions?address=${address}`);
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setPositions(data.data);
        
        // Calculate total value
        const total = data.data.reduce((sum: number, position: MoarPosition) => {
          return sum + parseFloat(position.value || '0');
        }, 0);
        
        setTotalValue(total);
        const totalWithRewards = total + totalRewardsValue;
        onPositionsValueChange?.(totalWithRewards);
      } else {
        setPositions([]);
        setTotalValue(0);
        onPositionsValueChange?.(totalRewardsValue);
      }
    } catch (error) {
      console.error('Error fetching Moar Market positions:', error);
      setPositions([]);
      setTotalValue(0);
      onPositionsValueChange?.(totalRewardsValue);
    } finally {
      setIsLoading(false);
      onPositionsCheckComplete?.();
    }
  };

  // Don't show the card during loading
  if (isLoading) {
    return null;
  }

  // Don't show the card if there are no positions and no rewards
  if (positions.length === 0 && totalRewardsValue === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('moar')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 relative">
              <Image 
                src="/protocol_ico/moar-market-logo-primary.png" 
                alt="Moar Market"
                width={20}
                height={20}
                className="object-contain"
              />
            </div>
            <CardTitle className="text-lg">Moar Market</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg whitespace-nowrap">{formatCurrency(totalValue + totalRewardsValue)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('moar') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
        
        {isExpanded('moar') && (
          <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
            <ScrollArea className="h-full">
              {positions.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  {isLoading ? 'Loading positions...' : 'No positions found'}
                </div>
              ) : (
                <div className="space-y-2">
                  {positions
                    .sort((a, b) => parseFloat(b.value) - parseFloat(a.value))
                    .map((position, index) => {
                    const amount = parseFloat(position.balance) / Math.pow(10, position.assetInfo.decimals);
                    const value = parseFloat(position.value);
                    
                    return (
                      <div key={`${position.poolId}-${index}`} className="mb-2 rounded p-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {position.assetInfo.logoUrl && (
                              <div className="w-6 h-6 relative">
                                <Image 
                                  src={position.assetInfo.logoUrl} 
                                  alt={position.assetInfo.symbol}
                                  width={24}
                                  height={24}
                                  className="object-contain"
                                />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{position.assetInfo.symbol}</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-600 border border-green-500/20">
                                  Supply
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(value / amount)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium whitespace-nowrap">{formatCurrency(value)}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatNumber(amount, 4)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Total Rewards */}
              {totalRewardsValue > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200 cursor-help">
                        <span className="text-sm text-muted-foreground">💰 Total rewards:</span>
                        <span className="text-sm font-medium whitespace-nowrap">{formatCurrency(totalRewardsValue)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border-border max-w-xs">
                      <div className="text-xs font-semibold mb-1">Rewards breakdown:</div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {rewardsData?.data?.map((reward: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            {reward.logoUrl && (
                              <img src={reward.logoUrl} alt={reward.symbol} className="w-3 h-3 rounded-full" />
                            )}
                            <span>{reward.symbol}</span>
                            <span>{formatNumber(reward.amount, 6)}</span>
                            <span className="text-gray-300">{formatCurrency(reward.usdValue)}</span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {protocol && showManageButton && (
                <ManagePositionsButton protocol={protocol} />
              )}
            </ScrollArea>
          </CardContent>
        )}
    </Card>
  );
}
