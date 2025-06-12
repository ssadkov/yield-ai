import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Token } from "@/lib/types/token";

interface TokenItemProps {
  token: Token;
}

export function TokenItem({ token }: TokenItemProps) {
  const formattedAmount = (parseFloat(token.amount) / Math.pow(10, token.decimals)).toFixed(3);
  const formattedValue = token.value ? `$${parseFloat(token.value).toFixed(2)}` : 'N/A';
  const formattedPrice = token.price ? `$${parseFloat(token.price).toFixed(2)}` : 'N/A';
  const symbol = token.symbol || token.name || 'Unknown';

  return (
    <div className="flex items-center justify-between py-2 px-1 hover:bg-accent rounded-md transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarImage src={`/tokens/${symbol.toLowerCase()}.png`} />
          <AvatarFallback>{symbol.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium truncate">{symbol}</span>
          <span className="text-xs text-muted-foreground">{formattedPrice}</span>
        </div>
      </div>
      <div className="text-sm text-right ml-2">
        <div className="font-medium whitespace-nowrap">{formattedAmount}</div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">{formattedValue}</div>
      </div>
    </div>
  );
} 