import { useState, useEffect } from 'react';
import { Token } from '@/lib/types/token';
import { getVaultTokenSymbol } from '@/lib/services/hyperion/vaultTokens';
import { VaultCalculator, VaultData } from '@/lib/services/hyperion/vaultCalculator';

interface VaultTokensDisplayProps {
  vaultTokens: Token[];
  walletAddress: string;
  onVaultDataChange?: (vaultData: VaultData[]) => void;
}

export function VaultTokensDisplay({ vaultTokens, walletAddress, onVaultDataChange }: VaultTokensDisplayProps) {
  const [vaultData, setVaultData] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загружаем данные Vault токенов из блокчейна
  useEffect(() => {
    async function loadVaultData() {
      if (vaultTokens.length === 0 || !walletAddress) {
        setVaultData([]);
        onVaultDataChange?.([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const calculator = new VaultCalculator();
        const vaultTokenAddresses = vaultTokens.map(token => token.address);
        
        console.log('[VaultTokensDisplay] Loading vault data for:', vaultTokenAddresses);
        
        const data = await calculator.getAllVaultData(vaultTokenAddresses, walletAddress);
        setVaultData(data);
        onVaultDataChange?.(data);
        
        console.log('[VaultTokensDisplay] Vault data loaded:', data);

      } catch (err) {
        console.error('[VaultTokensDisplay] Error loading vault data:', err);
        setError('Failed to load vault data');
        setVaultData([]);
        onVaultDataChange?.([]);
      } finally {
        setLoading(false);
      }
    }

    loadVaultData();
  }, [vaultTokens, walletAddress, onVaultDataChange]);

  if (vaultTokens.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {vaultTokens.map((token, index) => (
          <div key={`${token.address}-${index}`} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{getVaultTokenSymbol(token.address)}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Loading...
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        {vaultTokens.map((token, index) => (
          <div key={`${token.address}-${index}`} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{getVaultTokenSymbol(token.address)}</span>
            </div>
            <div className="text-sm text-red-500">
              Error
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {vaultTokens.map((token, index) => {
        const vaultSymbol = getVaultTokenSymbol(token.address);
        
        // Ищем данные для этого Vault токена
        const vaultInfo = vaultData.find(data => data.vaultTokenAddress === token.address);
        const value = vaultInfo ? vaultInfo.totalValueUSD : 0;
        
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
