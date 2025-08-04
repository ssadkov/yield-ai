import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PositionProps {
  position: {
    assetName: string;
    assetType: string;
    balance: string;
    apy: string;
    value: string;
    assetInfo: {
      name: string;
      symbol: string;
      decimals: number;
      price: number;
      logoUrl?: string;
    };
  };
}

export function PositionCard({ position }: PositionProps) {
  const isSupply = position.assetType === 'supply';
  const value = parseFloat(position.value);
  const formattedBalance = parseFloat(position.balance).toFixed(4);
  const formattedApy = parseFloat(position.apy).toFixed(2);
  
  return (
    <Card className="w-full mb-3">
      <CardHeader className="flex flex-row items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <Avatar className="w-6 h-6">
              {position.assetInfo.logoUrl ? (
                <img src={position.assetInfo.logoUrl} alt={position.assetInfo.symbol} />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-xs">
                  {position.assetInfo.symbol.substring(0, 2)}
                </div>
              )}
            </Avatar>
            <Badge variant="outline" className={cn("mt-1 py-0 h-5 text-xs", isSupply 
              ? "bg-green-500/10 text-green-600 border-green-500/20"
              : "bg-red-500/10 text-red-600 border-red-500/20"
            )}>
              {isSupply ? 'Supply' : 'Borrow'}
            </Badge>
          </div>
          <div className="flex flex-col ml-1">
            <div className="text-sm font-medium">
              {position.assetInfo.symbol}
            </div>
            <div className="text-xs text-muted-foreground">
              {formattedBalance} {position.assetInfo.symbol}
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col">
          <div className="text-base font-medium">${value.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">
            {isSupply ? '📈' : '📉'} APR: {formattedApy}%
          </div>
        </div>
      </CardHeader>
    </Card>
  );
} 