import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat";

interface AavePositionProps {
  position: {
    underlying_asset: string;
    symbol: string;
    name: string;
    decimals: number;
    deposit_amount: number;
    deposit_value_usd: number;
    borrow_amount: number;
    borrow_value_usd: number;
    usage_as_collateral_enabled: boolean;
    liquidity_index: string;
    variable_borrow_index: string;
  };
}

export function PositionCard({ position }: AavePositionProps) {
  // Определяем тип позиции как в Echelon
  const isSupply = position.deposit_amount > 0;
  const assetType = isSupply ? 'supply' : 'borrow';
  
  // Адаптируем данные под интерфейс Echelon
  const balance = isSupply ? position.deposit_amount.toString() : position.borrow_amount.toString();
  const value = isSupply ? position.deposit_value_usd.toString() : position.borrow_value_usd.toString();
  
  const formattedBalance = formatNumber(parseFloat(balance), 4);
  const numericValue = parseFloat(value);
  
  return (
    <Card className="w-full mb-3">
      <CardHeader className="flex flex-row items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <Avatar className="w-6 h-6">
              <div className="flex h-full w-full items-center justify-center bg-muted text-xs">
                {position.symbol.substring(0, 2)}
              </div>
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
              {position.symbol}
            </div>
            <div className="text-xs text-muted-foreground">
              {formattedBalance} {position.symbol}
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col">
          <div className="text-base font-medium">{formatCurrency(numericValue, 2)}</div>
        </div>
      </CardHeader>
    </Card>
  );
}
