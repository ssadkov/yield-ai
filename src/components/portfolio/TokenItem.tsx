import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Token } from "@/lib/types/token";
import { getTokenList } from "@/lib/tokens/getTokenList";
import { useDragDrop } from "@/contexts/DragDropContext";
import { TokenDragData } from "@/types/dragDrop";
import { cn } from "@/lib/utils";

interface TokenItemProps {
  token: Token;
}

export function TokenItem({ token }: TokenItemProps) {
  const { startDrag, endDrag, state } = useDragDrop();
  
  const formattedAmount = (parseFloat(token.amount) / Math.pow(10, token.decimals)).toFixed(3);
  const formattedValue = token.value ? `$${parseFloat(token.value).toFixed(2)}` : 'N/A';
  const formattedPrice = token.price ? `$${parseFloat(token.price).toFixed(2)}` : 'N/A';
  const symbol = token.symbol || token.name || 'Unknown';

  // Находим токен в списке для получения logoUrl
  const tokenList = getTokenList(1); // 1 - это chainId для Aptos
  const tokenInfo = tokenList.find(t => t.symbol === symbol);
  const logoUrl = tokenInfo?.logoUrl;

  const handleDragStart = (e: React.DragEvent) => {
    const dragData: TokenDragData = {
      type: 'token',
      symbol,
      amount: token.amount,
      address: token.address,
      price: token.price || '0',
      value: token.value || '0',
      decimals: token.decimals,
      logoUrl,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    
    startDrag(dragData);
  };

  const handleDragEnd = () => {
    endDrag();
  };

  const isBeingDragged = state.isDragging && state.dragData?.type === 'token' && 
                        state.dragData.symbol === symbol;

  return (
    <div 
      className={cn(
        "flex items-center justify-between py-2 px-1 hover:bg-accent rounded-md transition-colors cursor-grab active:cursor-grabbing",
        isBeingDragged && "opacity-50"
      )}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarImage src={logoUrl} />
          <AvatarFallback>{symbol.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium truncate">{symbol}</span>
          <span className="text-xs text-muted-foreground">{formattedPrice}</span>
        </div>
      </div>
      <div className="text-sm text-right ml-2">
        <div className="font-medium whitespace-nowrap">{formattedValue}</div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">{formattedAmount}</div>
      </div>
    </div>
  );
} 