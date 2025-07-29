import { TokenItem } from "@/components/portfolio/TokenItem";
import { Token } from "@/lib/types/token";

interface TokenListProps {
  tokens: Token[];
}

export function TokenList({ tokens }: TokenListProps) {
  // Sort tokens by USD value in descending order (highest first)
  const sortedTokens = [...tokens].sort((a, b) => {
    const valueA = a.value ? parseFloat(a.value) : 0;
    const valueB = b.value ? parseFloat(b.value) : 0;
    return valueB - valueA;
  });

  return (
    <div className="space-y-2">
      {sortedTokens.map((token) => (
        <TokenItem key={token.address} token={token} />
      ))}
    </div>
  );
} 