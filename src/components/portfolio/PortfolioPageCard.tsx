import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TokenList } from "@/components/portfolio/TokenList";
import { Token } from "@/lib/types/token";
import { useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { CollapsibleControls } from "@/components/ui/collapsible-controls";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDragDrop } from "@/contexts/DragDropContext";
import { DragData } from "@/types/dragDrop";
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat";

interface PortfolioPageCardProps {
  totalValue: string;
  tokens: Token[];
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}

export function PortfolioPageCard({ totalValue, tokens, onRefresh, isRefreshing }: PortfolioPageCardProps) {
  const { isExpanded, toggleSection } = useCollapsible();
  const [hideSmallAssets, setHideSmallAssets] = useState(true);
  const { state, validateDrop, handleDrop } = useDragDrop();

  const filteredTokens = hideSmallAssets 
    ? tokens.filter(token => {
        const value = token.value ? parseFloat(token.value) : 0;
        return !isNaN(value) && value >= 1;
      })
    : tokens;

  const hiddenCount = tokens.length - filteredTokens.length;

  // Подсчет суммы для Wallet
  const walletTotal = tokens.reduce((sum, token) => {
    const value = token.value ? parseFloat(token.value) : 0;
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  // Преобразуем totalValue в число для отображения
  const displayTotalValue = parseFloat(totalValue) || 0;

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => {
    // Убираем подсветку при уходе курсора
  };

  const handleDropEvent = (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('application/json')) as DragData;
      handleDrop(dragData, 'wallet');
    } catch (error) {
      console.error('Error parsing drag data:', error);
    }
  };

  const getDropZoneClassName = () => {
    if (!state.dragData) {
      return "";
    }

    const validation = validateDrop(state.dragData, 'wallet');
    
    if (validation.isValid) {
      return "bg-green-50 border-green-200";
    }
    if ((validation as any).requiresSwap) {
      return "bg-yellow-50 border-yellow-200";
    }
    return "bg-red-50 border-red-200";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="hideSmallAssets" 
            checked={hideSmallAssets}
            onCheckedChange={(checked) => setHideSmallAssets(checked as boolean)}
          />
          <Label htmlFor="hideSmallAssets" className="text-sm">Hide assets {'<'}1$</Label>
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="h-4 w-4 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground/60 opacity-80 transition-colors"
                >
                  <RefreshCw className={cn(
                    "h-3 w-3",
                    isRefreshing && "animate-spin"
                  )} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh all data</p>
              </TooltipContent>
            </Tooltip>
          )}
          <CollapsibleControls />
        </div>
      </div>
      <Card 
        className={`w-full h-full flex flex-col transition-colors ${getDropZoneClassName()}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropEvent}
      >
        <CardHeader 
          className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => toggleSection('wallet')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-500"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path></svg>
              Wallet
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-lg">{formatCurrency(walletTotal, 2)}</span>
              <ChevronDown className={cn(
                "h-5 w-5 transition-transform",
                isExpanded('wallet') ? "transform rotate-0" : "transform -rotate-90"
              )} />
            </div>
          </div>
        </CardHeader>

        {isExpanded('wallet') && (
          <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
            <ScrollArea className="h-full">
              <TokenList tokens={filteredTokens} />
              {hiddenCount > 0 && (
                <div className="text-xs text-muted-foreground py-1 text-right">
                  {hiddenCount} assets hidden
                </div>
              )}
            </ScrollArea>
          </CardContent>
        )}
      </Card>
    </div>
  );
} 