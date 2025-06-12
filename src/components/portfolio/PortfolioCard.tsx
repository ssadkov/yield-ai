import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TokenList } from "@/components/portfolio/TokenList";
import { Token } from "@/lib/types/token";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface PortfolioCardProps {
  totalValue: string;
  tokens: Token[];
}

export function PortfolioCard({ totalValue, tokens }: PortfolioCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [hideSmallAssets, setHideSmallAssets] = useState(true);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-medium">Assets</span>
        <span className="text-lg font-medium">${totalValue}</span>
      </div>
      <div className="flex items-center space-x-2 mb-2">
        <Checkbox 
          id="hideSmallAssets" 
          checked={hideSmallAssets}
          onCheckedChange={(checked) => setHideSmallAssets(checked as boolean)}
        />
        <Label htmlFor="hideSmallAssets" className="text-sm">Hide assets {'<'}1$</Label>
      </div>
      <Card className="w-full h-full flex flex-col">
        <CardHeader 
          className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Wallet</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-lg">${walletTotal.toFixed(2)}</span>
              <ChevronDown className={cn(
                "h-5 w-5 transition-transform",
                isExpanded ? "transform rotate-0" : "transform -rotate-90"
              )} />
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
            <ScrollArea className="h-full">
              <TokenList tokens={filteredTokens} />
              {hiddenCount > 0 && (
                <div className="text-sm text-muted-foreground py-2 text-center">
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