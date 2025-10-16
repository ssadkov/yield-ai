'use client';

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getVaultTokenMapping } from "@/lib/services/hyperion/vaultTokens";
import { VaultData } from "@/lib/services/hyperion/vaultCalculator";

interface VaultPositionProps {
  vaultToken: any;
  vaultData: VaultData;
  index: number;
  onWithdraw?: () => void;
}

const VaultPosition = memo(function VaultPosition({ vaultToken, vaultData, index, onWithdraw }: VaultPositionProps) {
  const vaultMapping = getVaultTokenMapping(vaultToken.address);
  const token1 = vaultMapping?.tokens[0];
  const token2 = vaultMapping?.tokens[1];
  const value = vaultData.totalValueUSD;

  return (
    <div className="p-4 border-b last:border-b-0">
      {/* Desktop layout */}
      <div className="hidden md:flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {/* Значки токенов слева */}
            {token1 && token2 && (
              <div className="flex -space-x-2 mr-2">
                <img 
                  src={token1.logoUrl} 
                  alt={token1.symbol} 
                  className="w-8 h-8 rounded-full border-2 border-white object-contain"
                />
                <img 
                  src={token2.logoUrl} 
                  alt={token2.symbol} 
                  className="w-8 h-8 rounded-full border-2 border-white object-contain"
                />
              </div>
            )}
            <span className="text-lg font-semibold">
              {token1?.symbol || 'Unknown'} / {token2?.symbol || 'Unknown'}
            </span>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs font-normal px-2 py-0.5 h-5 ml-2">
             GOBLIN VAULT
            </Badge>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {/* Сумма справа */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-right w-24">${value.toFixed(2)}</span>
          </div>
          {/* Кнопка Withdraw */}
          {onWithdraw && (
            <Button
              onClick={onWithdraw}
              variant="outline"
              size="sm"
              className="mt-1"
            >
              Withdraw
            </Button>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden space-y-3">
        {/* Header с токенами и статусом */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {token1 && token2 && (
              <div className="flex -space-x-2 mr-2">
                <img 
                  src={token1.logoUrl} 
                  alt={token1.symbol} 
                  className="w-8 h-8 rounded-full border-2 border-white object-contain"
                />
                <img 
                  src={token2.logoUrl} 
                  alt={token2.symbol} 
                  className="w-8 h-8 rounded-full border-2 border-white object-contain"
                />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-lg font-semibold">
                {token1?.symbol || 'Unknown'} / {token2?.symbol || 'Unknown'}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs font-normal px-2 py-0.5 h-5">
                  GOBLIN VAULT
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-right w-24">${value.toFixed(2)}</span>
          </div>
        </div>
        
        {/* Кнопка Withdraw для мобильной версии */}
        {onWithdraw && (
          <Button
            onClick={onWithdraw}
            variant="outline"
            size="sm"
            className="w-full mt-2"
          >
            Withdraw
          </Button>
        )}
      </div>
    </div>
  );
});

export { VaultPosition };
