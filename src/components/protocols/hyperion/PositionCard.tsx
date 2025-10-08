import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { sdk } from "@/lib/hyperion";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/numberFormat";

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
  isManageView?: boolean;
}

export function PositionCard({ position, isManageView = false }: PositionProps) {
  const { signAndSubmitTransaction, account } = useWallet();
  const [isClaiming, setIsClaiming] = useState(false);
  const { toast } = useToast();
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

  const handleClaimRewards = async () => {
    if (!signAndSubmitTransaction || !account?.address) return;
    
    try {
      setIsClaiming(true);
      const payload = await sdk.Position.claimAllRewardsTransactionPayload({
        positionId: position.position.objectId,
        recipient: account.address.toString()
      });

      const response = await signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.typeArguments,
          functionArguments: payload.functionArguments
        },
        options: {
          maxGasAmount: 20000, // Network limit is 20000
        },
      });

      // console.log('Transaction hash:', response.hash);
      toast({
        title: "Success",
        description: `Transaction hash: ${response.hash.slice(0, 6)}...${response.hash.slice(-4)}`,
        action: (
          <ToastAction altText="View in Explorer" onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${response.hash}?network=mainnet`, '_blank')}>
            View in Explorer
          </ToastAction>
        ),
      });
    } catch (error) {
      // console.error('Error claiming rewards:', error);
      toast({
        title: "Error",
        description: "Failed to claim rewards",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };
  
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
              <Badge variant="outline" className="mt-1 py-0 h-5 bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                Inactive
              </Badge>
            )}
          </div>
          <div className="flex flex-col ml-1">
            <div className="text-sm font-medium">
              {token1.symbol}/{token2.symbol}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-base font-medium">{formatCurrency(parseFloat(position.value), 2)}</div>
        </div>
      </CardHeader>    
    </Card>
  );
} 