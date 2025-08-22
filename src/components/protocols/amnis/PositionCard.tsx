import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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
  // Determine token symbol
  const tokenSymbol = position.tokenSymbol || 
    (position.token.includes('AptosCoin') ? 'APT' : 
     position.token.includes('AmnisApt') ? 'amAPT' : 
     position.token.includes('StakedApt') ? 'stAPT' : 'AMI');

  // Convert staked amount from octas to tokens
  const stakedTokens = parseFloat(position.stakedAmount) / 100000000;
  
  // Use usdValue if available, otherwise fallback to value
  const displayValue = position.usdValue || position.value || 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold">
              {tokenSymbol} Staking
            </CardTitle>
            <Badge variant="secondary">Staking</Badge>
          </div>
          <Badge variant={position.isActive ? "default" : "secondary"}>
            {position.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {position.poolName}
          {position.lockDuration && ` • ${position.lockDuration}`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Staked Amount</p>
            <p className="text-lg font-semibold">{stakedTokens.toFixed(2)} {tokenSymbol}</p>
          </div>
          {position.stakingTokenAmount && (
            <div>
              <p className="text-sm text-muted-foreground">Staking Tokens</p>
              <p className="text-lg font-semibold">{position.stakingTokenAmount} st{tokenSymbol}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">Value</p>
            <p className="text-lg font-semibold">${displayValue.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">APR</p>
            <p className="text-lg font-semibold text-green-600">{position.apy.toFixed(2)}%</p>
          </div>
        </div>
        
        {position.rewards && position.rewards > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Unclaimed Rewards</p>
              <p className="text-lg font-semibold text-yellow-600">
                {position.rewards.toFixed(4)} {tokenSymbol}
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
          {onClaim && position.rewards && position.rewards > 0 && (
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