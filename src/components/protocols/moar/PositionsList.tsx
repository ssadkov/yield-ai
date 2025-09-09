"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useCollapsible } from '@/contexts/CollapsibleContext';

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
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
  onPositionsCheckComplete,
  showManageButton = true 
}: PositionsListProps) {
  const [positions, setPositions] = useState<MoarPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const { isExpanded, toggleExpanded } = useCollapsible();

  useEffect(() => {
    if (address) {
      fetchPositions();
    }
  }, [address]);

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
        onPositionsValueChange?.(total);
      } else {
        setPositions([]);
        setTotalValue(0);
        onPositionsValueChange?.(0);
      }
    } catch (error) {
      console.error('Error fetching Moar Market positions:', error);
      setPositions([]);
      setTotalValue(0);
      onPositionsValueChange?.(0);
    } finally {
      setIsLoading(false);
      onPositionsCheckComplete?.();
    }
  };

  const handleManageClick = () => {
    window.open('https://app.moar.market/lend', '_blank');
  };

  return (
    <Card className="w-full">
      <Collapsible 
        open={isExpanded('moar')} 
        onOpenChange={() => toggleExpanded('moar')}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 relative">
                  <Image 
                    src="/protocol_ico/moar-market-logo-primary.png" 
                    alt="Moar Market"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Moar Market</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {isLoading ? 'Loading...' : `${positions.length} position${positions.length !== 1 ? 's' : ''}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {totalValue > 0 && (
                  <div className="text-sm font-medium">
                    ${totalValue.toFixed(2)}
                  </div>
                )}
                {isExpanded('moar') ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        {isExpanded('moar') && (
          <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
            <ScrollArea className="h-full">
              {positions.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  {isLoading ? 'Loading positions...' : 'No positions found'}
                </div>
              ) : (
                <div className="space-y-2">
                  {positions.map((position, index) => {
                    const amount = parseFloat(position.balance) / Math.pow(10, position.assetInfo.decimals);
                    const value = parseFloat(position.value);
                    
                    return (
                      <div key={`${position.poolId}-${index}`} className="mb-2">
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
                            <div className="flex flex-col">
                              <div className="text-sm font-medium">
                                {position.assetInfo.symbol}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Pool #{position.poolId}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="text-sm font-medium">
                              ${value.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {amount.toFixed(4)} {position.assetInfo.symbol}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {showManageButton && (
                <div className="mt-4 pt-3 border-t">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={handleManageClick}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Manage on Moar Market
                  </Button>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        )}
      </Collapsible>
    </Card>
  );
}
