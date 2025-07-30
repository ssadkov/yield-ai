import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface PositionProps {
  position: {
    positionAddr: string;
    poolId: string;
    poolType: string;
    feeTier: string;
    tvl: string;
    volume24h: string;
    shareOfPool: string;
    apr: {
      totalAprPercentage: string;
      feeAprPercentage: string;
      boostedAprPercentage: string;
      campaignAprs: Array<{
        aprPercentage: string;
        campaignIdx: string;
        token: {
          addr: string;
          decimals: number;
          img: string;
          symbol: string;
          verified: boolean;
        };
      }>;
    };
    initialDeposits: Array<{
      addr: string;
      amount: string;
      decimals: number;
      idx: number;
      img: string;
      symbol: string;
      usd: string;
      verified: boolean;
    }>;
    estimatedWithdrawals: Array<{
      addr: string;
      amount: string;
      decimals: number;
      idx: number;
      img: string;
      symbol: string;
      usd: string;
      verified: boolean;
    }>;
    totalEarnings: Array<{
      addr: string;
      amount: string;
      decimals: number;
      idx: number;
      img: string;
      symbol: string;
      usd: string;
      verified: boolean;
    }>;
    estimatedIncentives: Array<{
      addr: string;
      amount: string;
      decimals: number;
      idx: number;
      img: string;
      symbol: string;
      usd: string;
      verified: boolean;
    }>;
  };
}

export function PositionCard({ position }: PositionProps) {
  // Получаем информацию о токенах из initialDeposits
  const token1 = position.initialDeposits[0];
  const token2 = position.initialDeposits[1];
  
  // Считаем общую стоимость позиции
  const totalValue = position.estimatedWithdrawals.reduce((sum, token) => {
    return sum + parseFloat(token.usd || "0");
  }, 0);
  
  // Считаем общие награды (стимулы)
  const totalIncentives = position.estimatedIncentives.reduce((sum, incentive) => {
    return sum + parseFloat(incentive.usd || "0");
  }, 0);
  
  return (
    <Card className="w-full mb-3">
      <CardHeader className="flex flex-row items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="flex">
              <Avatar className="w-6 h-6">
                <img src={token1.img} alt={token1.symbol} />
              </Avatar>
              <Avatar className="w-6 h-6 -ml-2">
                <img src={token2.img} alt={token2.symbol} />
              </Avatar>
            </div>
            <Badge variant="outline" className="mt-1 py-0 h-5 bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
              {position.poolType}
            </Badge>
          </div>
          <div className="flex flex-col ml-1">
            <div className="text-sm font-medium">
              {token1.symbol}/{token2.symbol}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-base font-medium">${totalValue.toFixed(2)}</div>
        </div>
      </CardHeader>
    </Card>
  );
} 