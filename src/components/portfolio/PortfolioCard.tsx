import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TokenList } from "@/components/portfolio/TokenList";
import { Token } from "@/lib/types/token";

interface PortfolioCardProps {
  totalValue: string;
  tokens: Token[];
}

export function PortfolioCard({ totalValue, tokens }: PortfolioCardProps) {
  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle>Assets</CardTitle>
        <p className="text-sm text-muted-foreground">Total: ${totalValue}</p>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto px-3">
        <ScrollArea className="h-full">
          <TokenList tokens={tokens} />
        </ScrollArea>
      </CardContent>
    </Card>
  );
} 