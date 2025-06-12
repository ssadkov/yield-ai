import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TokenList } from "@/components/portfolio/TokenList";
import { Token } from "@/lib/types/token";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioCardProps {
  totalValue: string;
  tokens: Token[];
}

export function PortfolioCard({ totalValue, tokens }: PortfolioCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-medium">Assets</span>
        <span className="text-lg font-medium">${totalValue}</span>
      </div>
      <Card className="w-full h-full flex flex-col">
        <CardHeader 
          className="pb-2 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Wallet</CardTitle>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="flex-1 overflow-y-auto px-3">
            <ScrollArea className="h-full">
              <TokenList tokens={tokens} />
            </ScrollArea>
          </CardContent>
        )}
      </Card>
    </div>
  );
} 