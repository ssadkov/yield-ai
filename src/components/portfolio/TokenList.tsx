import { TokenItem } from "@/components/portfolio/TokenItem";
import { Token } from "@/lib/types/token";
import { useEffect, useState } from "react";

interface TokenListProps {
  tokens: Token[];
  disableDrag?: boolean;
}

export function TokenList({ tokens, disableDrag = false }: TokenListProps) {
  const [stakingAprs, setStakingAprs] = useState<Record<string, { aprPct: number; source: string }>>({});

  useEffect(() => {
    let isCancelled = false;

    const fetchStakingAprs = async () => {
      try {
        const response = await fetch('/api/protocols/echelon/v2/pools');
        if (!response.ok) return;
        const data = await response.json();
        if (!isCancelled && data && data.success) {
          setStakingAprs(data.stakingAprs || {});
        }
      } catch (_) {
        // silently ignore
      }
    };

    fetchStakingAprs();
    return () => { isCancelled = true; };
  }, []);
  // Sort tokens by USD value in descending order (highest first)
  const sortedTokens = [...tokens].sort((a, b) => {
    const valueA = a.value ? parseFloat(a.value) : 0;
    const valueB = b.value ? parseFloat(b.value) : 0;
    return valueB - valueA;
  });

  return (
    <div className="space-y-2">
      {sortedTokens.map((token) => (
        <TokenItem key={token.address} token={token} stakingAprs={stakingAprs} disableDrag={disableDrag} />
      ))}
    </div>
  );
} 