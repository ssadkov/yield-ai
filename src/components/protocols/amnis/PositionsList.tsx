'use client';

import React from 'react';
import { AmnisPositionCard } from './PositionCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Plus } from 'lucide-react';

interface AmnisPosition {
  symbol: string;
  amount: string;
  stakingTokenAmount: string;
  value: number;
  apy: number;
  rewards: number;
  type: string;
  assetInfo: any;
  poolName: string;
  isActive: boolean;
}

interface AmnisPositionsListProps {
  positions: AmnisPosition[];
  totalValue: number;
  onWithdraw?: (position: AmnisPosition) => void;
  onClaim?: (position: AmnisPosition) => void;
  onStake?: () => void;
}

export const AmnisPositionsList: React.FC<AmnisPositionsListProps> = ({
  positions,
  totalValue,
  onWithdraw,
  onClaim,
  onStake
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
            <p className="text-lg font-semibold">${totalValue.toFixed(2)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {positions.map((position, index) => (
            <AmnisPositionCard
              key={index}
              position={position}
              onWithdraw={onWithdraw}
              onClaim={onClaim}
            />
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