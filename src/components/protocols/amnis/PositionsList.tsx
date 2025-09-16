'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AmnisPositionCard } from './PositionCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { cn } from "@/lib/utils";

interface AmnisPosition {
  id: string;
  poolId: string;
  poolName: string;
  token: string;
  tokenSymbol?: string;
  stakedAmount: string;
  stakingTokenAmount?: string;
  value?: number;
  usdValue?: number;
  apy: number;
  rewards?: number;
  type?: string;
  assetInfo?: any;
  isActive: boolean;
  lockDuration?: string;
  pools?: any[];
}

interface AmnisPositionsListProps {
  positions: AmnisPosition[];
  totalValue: number;
  onWithdraw?: (position: AmnisPosition) => void;
  onClaim?: (position: AmnisPosition) => void;
  onStake?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Component for use in ManagePositions
export const AmnisPositionsList: React.FC<AmnisPositionsListProps> = ({
  positions,
  totalValue,
  onWithdraw,
  onClaim,
  onStake,
  isCollapsed = false,
  onToggleCollapse
}) => {
  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img 
              src="/amnis-logo.png" 
              alt="Amnis Finance" 
              className="w-6 h-6 rounded"
            />
            Amnis Finance
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            No staking positions found
          </p>
          <div className="flex gap-2 justify-center">
            {onStake && (
              <Button onClick={onStake} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Start Staking
              </Button>
            )}
            <Button variant="outline" asChild>
              <a href="https://stake.amnis.finance/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Visit Amnis
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <img 
              src="/amnis-logo.png" 
              alt="Amnis Finance" 
              className="w-6 h-6 rounded"
            />
            Amnis Finance
          </CardTitle>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-lg font-semibold">${(totalValue || 0).toFixed(2)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {positions.map((position, index) => (
            <div key={position.id || index}>
              <AmnisPositionCard
                position={position}
                onWithdraw={onWithdraw}
                onClaim={onClaim}
              />
              
              {/* Show pool details for AMI staking positions */}
              {position.pools && position.pools.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between mt-2">
                      <span className="text-xs text-muted-foreground">Pool Details</span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2 pl-4">
                      {position.pools.map((pool, poolIndex) => (
                        <div key={poolIndex} className="text-xs bg-muted p-2 rounded">
                          <div className="flex justify-between">
                            <span>Pool: {pool.address.substring(0, 8)}...{pool.address.substring(pool.address.length - 8)}</span>
                            <span className="text-green-600">{(pool.rate * 100).toFixed(2)}% APY</span>
                          </div>
                          <div className="text-muted-foreground">
                            Staked: {(pool.stakedAmount / 100000000).toFixed(2)} AMI
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ))}
        </div>
        
        <div className="flex justify-center pt-4">
          <Button variant="outline" asChild>
            <a href="https://stake.amnis.finance/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Manage on Amnis
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Component for use in Sidebar
interface SidebarPositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  onPositionsCheckComplete?: () => void;
}

export const PositionsList: React.FC<SidebarPositionsListProps & { refreshKey?: number }> = ({ 
  address, 
  onPositionsValueChange,
  onPositionsCheckComplete,
  refreshKey,
}) => {
  const { account } = useWallet();
  const { isExpanded, toggleSection } = useCollapsible();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch real data from API
  const fetchPositions = useCallback(async () => {
    if (!address) { onPositionsCheckComplete?.(); return; }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/protocols/amnis/userPositions?address=${address}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.positions) {
        setPositions(data.positions);
      } else {
        setPositions([]);
      }
    } catch (err) {
      console.error('Error fetching Amnis positions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch positions');
      // Keep previous positions on error to avoid flicker
    } finally {
      setLoading(false);
      onPositionsCheckComplete?.();
    }
  }, [address]);

  // Fetch data on mount and when address changes
  useEffect(() => {
    fetchPositions();
  }, [fetchPositions, refreshKey]);

  // Calculate total value from positions
  const totalValue = positions.reduce((sum, position) => {
    return sum + (position.usdValue || 0);
  }, 0);

  // Notify parent about value change
  useEffect(() => {
    if (onPositionsValueChange) {
      onPositionsValueChange(totalValue);
    }
  }, [onPositionsValueChange, totalValue]);

  // Don't render card if no positions
  if (positions.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('amnis')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 relative">
              <img 
                src="/amnis-logo.png" 
                alt="Amnis Finance"
                className="w-5 h-5 object-contain"
              />
            </div>
            <CardTitle className="text-lg">Amnis Finance</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg">${totalValue.toFixed(2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('amnis') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      {isExpanded('amnis') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="text-center py-4 text-red-500 text-sm">{error}</div>
          ) : (
            <div className="space-y-2">
              {positions.map((position) => (
                <div key={position.id} className="mb-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 relative">
                        <img 
                          src="/amnis-logo.png" 
                          alt={position.tokenSymbol || "AMI"}
                          className="w-6 h-6 object-contain"
                        />
                      </div>
                                              <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{position.tokenSymbol || "AMI"}</span>
                            <Badge variant="secondary">Staking</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ${(position.usdValue / parseFloat(position.stakedAmount)).toFixed(3)}
                          </div>
                        </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">${(position.usdValue || 0).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">
                        {parseFloat(position.stakedAmount).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}; 