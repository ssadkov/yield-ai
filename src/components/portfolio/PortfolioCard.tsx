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
            <CardTitle className="text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-500"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path></svg>
              Wallet
            </CardTitle>
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