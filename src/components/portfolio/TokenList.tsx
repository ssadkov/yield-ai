import { TokenItem } from "@/components/portfolio/TokenItem";
import { Token } from "@/lib/types/token";

interface TokenListProps {
  tokens: Token[];
}

export function TokenList({ tokens }: TokenListProps) {
  return (
    <div className="space-y-2">
      {tokens.map((token) => (
        <TokenItem key={token.address} token={token} />
      ))}
    </div>
  );
} 