import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface PositionProps {
  position: {
    isActive: boolean;
    value: string;
    farm: {
      claimed: any[];
      unclaimed: Array<{
        amount: string;
        amountUSD: string;
        token: string;
      }>;
    };
    fees: {
      claimed: any[];
      unclaimed: Array<{
        amount: string;
        amountUSD: string;
        token: string;
      }>;
    };
    position: {
      objectId: string;
      poolId: string;
      tickLower: number;
      tickUpper: number;
      createdAt: string;
      pool: {
        currentTick: number;
        feeRate: string;
        feeTier: number;
        poolId: string;
        token1: string;
        token2: string;
        token1Info: {
          logoUrl: string;
          symbol: string;
        };
        token2Info: {
          logoUrl: string;
          symbol: string;
        };
      };
    };
  };
}

export function PositionCard({ position }: PositionProps) {
  const token1 = position.position.pool.token1Info;
  const token2 = position.position.pool.token2Info;
  
  // Считаем общие награды (фарм + комиссии)
  const farmRewards = position.farm.unclaimed.reduce((sum, reward) => {
    return sum + parseFloat(reward.amountUSD || "0");
  }, 0);
  
  const feeRewards = position.fees.unclaimed.reduce((sum, fee) => {
    return sum + parseFloat(fee.amountUSD || "0");
  }, 0);
  
  const totalRewards = farmRewards + feeRewards;
  
  return (
    <Card className="w-full mb-3">
      <CardHeader className="flex flex-row items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="flex">
              <Avatar className="w-6 h-6">
                <img src={token1.logoUrl} alt={token1.symbol} />
              </Avatar>
              <Avatar className="w-6 h-6 -ml-2">
                <img src={token2.logoUrl} alt={token2.symbol} />
              </Avatar>
            </div>
            {position.isActive ? (
              <Badge variant="outline" className="mt-1 py-0 h-5 bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-1 py-0 h-5 text-xs">
                Inactive
              </Badge>
            )}
          </div>
          <div className="flex flex-col ml-1">
            <div className="text-sm font-medium">
              {token1.symbol} / {token2.symbol}
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col">
          <div className="text-base font-medium">${parseFloat(position.value).toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">
            💰 Rewards: ${totalRewards.toFixed(2)}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
} 