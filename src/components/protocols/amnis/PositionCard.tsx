import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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

interface AmnisPositionCardProps {
  position: AmnisPosition;
  onWithdraw?: (position: AmnisPosition) => void;
  onClaim?: (position: AmnisPosition) => void;
}

export const AmnisPositionCard: React.FC<AmnisPositionCardProps> = ({
  position,
  onWithdraw,
  onClaim
}) => {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {position.symbol} Staking
          </CardTitle>
          <Badge variant={position.isActive ? "default" : "secondary"}>
            {position.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {position.poolName}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Staked Amount</p>
            <p className="text-lg font-semibold">{position.amount} {position.symbol}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Staking Tokens</p>
            <p className="text-lg font-semibold">{position.stakingTokenAmount} st{position.symbol}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Value</p>
            <p className="text-lg font-semibold">${position.value.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">APY</p>
            <p className="text-lg font-semibold text-green-600">{position.apy.toFixed(2)}%</p>
          </div>
        </div>
        
        {position.rewards > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Unclaimed Rewards</p>
              <p className="text-lg font-semibold text-yellow-600">
                {position.rewards.toFixed(4)} {position.symbol}
              </p>
            </div>
          </>
        )}
        
        <div className="flex gap-2">
          {onWithdraw && (
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onWithdraw(position)}
            >
              Unstake
            </Button>
          )}
          {onClaim && position.rewards > 0 && (
            <Button 
              variant="default" 
              className="flex-1"
              onClick={() => onClaim(position)}
            >
              Claim Rewards
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 