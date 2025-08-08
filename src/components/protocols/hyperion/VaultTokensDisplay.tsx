import { Token } from '@/lib/types/token';
import { getVaultTokenSymbol } from '@/lib/services/hyperion/vaultTokens';

interface VaultTokensDisplayProps {
  vaultTokens: Token[];
}

export function VaultTokensDisplay({ vaultTokens }: VaultTokensDisplayProps) {
  if (vaultTokens.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {vaultTokens.map((token, index) => {
        const vaultSymbol = getVaultTokenSymbol(token.address);
        const value = token.value ? parseFloat(token.value) : 0;
        
        return (
          <div key={`${token.address}-${index}`} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{vaultSymbol}</span>
            </div>
            <div className="text-sm font-bold">
              ${value.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
