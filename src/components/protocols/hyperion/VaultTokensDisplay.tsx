import { useState, useEffect } from 'react';
import { Token } from '@/lib/types/token';
import { getVaultTokenSymbol, getVaultTokenMapping } from '@/lib/services/hyperion/vaultTokens';
import { VaultCalculator, VaultData } from '@/lib/services/hyperion/vaultCalculator';
import { Avatar } from '@/components/ui/avatar';

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
        {vaultTokens.map((token, index) => {
          const vaultMapping = getVaultTokenMapping(token.address);
          const token1 = vaultMapping?.tokens[0];
          const token2 = vaultMapping?.tokens[1];
          
          return (
            <div key={`${token.address}-${index}`} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                {token1 && token2 && (
                  <div className="flex">
                    <Avatar className="w-6 h-6">
                      <img src={token1.logoUrl} alt={token1.symbol} />
                    </Avatar>
                    <Avatar className="w-6 h-6 -ml-2">
                      <img src={token2.logoUrl} alt={token2.symbol} />
                    </Avatar>
                  </div>
                )}
                <div className="text-sm font-medium">
                  {token1?.symbol}/{token2?.symbol}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Loading...
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        {vaultTokens.map((token, index) => {
          const vaultMapping = getVaultTokenMapping(token.address);
          const token1 = vaultMapping?.tokens[0];
          const token2 = vaultMapping?.tokens[1];
          
          return (
            <div key={`${token.address}-${index}`} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                {token1 && token2 && (
                  <div className="flex">
                    <Avatar className="w-6 h-6">
                      <img src={token1.logoUrl} alt={token1.symbol} />
                    </Avatar>
                    <Avatar className="w-6 h-6 -ml-2">
                      <img src={token2.logoUrl} alt={token2.symbol} />
                    </Avatar>
                  </div>
                )}
                <div className="text-sm font-medium">
                  {token1?.symbol}/{token2?.symbol}
                </div>
              </div>
              <div className="text-sm text-red-500">
                Error
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {vaultTokens
        .map((token, index) => {
          const vaultMapping = getVaultTokenMapping(token.address);
          const token1 = vaultMapping?.tokens[0];
          const token2 = vaultMapping?.tokens[1];
          
          // Ищем данные для этого Vault токена
          const vaultInfo = vaultData.find(data => data.vaultTokenAddress === token.address);
          const value = vaultInfo ? vaultInfo.totalValueUSD : 0;
          
          return {
            token,
            index,
            token1,
            token2,
            value
          };
        })
        .sort((a, b) => b.value - a.value) // Сортировка от большего к меньшему
        .map(({ token, index, token1, token2, value }) => (
          <div key={`${token.address}-${index}`} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              {token1 && token2 && (
                <div className="flex">
                  <Avatar className="w-6 h-6">
                    <img src={token1.logoUrl} alt={token1.symbol} />
                  </Avatar>
                  <Avatar className="w-6 h-6 -ml-2">
                    <img src={token2.logoUrl} alt={token2.symbol} />
                  </Avatar>
                </div>
              )}
              <div className="text-sm font-medium">
                {token1?.symbol}/{token2?.symbol}
              </div>
            </div>
            <div className="text-sm font-medium">
              ${value.toFixed(2)}
            </div>
          </div>
        ))}
    </div>
  );
}
