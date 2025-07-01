'use client';

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { sdk } from "@/lib/hyperion";
import { getRemoveLiquidityPayload } from "@/lib/services/protocols/hyperion/pools";
import { ConfirmRemoveModal } from "@/components/ui/confirm-remove-modal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HyperionPositionProps {
  position: any;
  index: number;
}

function HyperionPosition({ position, index }: HyperionPositionProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const { signAndSubmitTransaction, account } = useWallet();
  const { toast } = useToast();

  // Считаем награды
  const farmRewards = position.farm?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
  const feeRewards = position.fees?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
  const totalRewards = farmRewards + feeRewards;

  const handleClaimRewards = async () => {
    if (!signAndSubmitTransaction || !account?.address) return;
    try {
      setIsClaiming(true);
      const payload = await sdk.Position.claimAllRewardsTransactionPayload({
        positionId: position.position.objectId,
        recipient: account.address.toString()
      });
      const response = await signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.typeArguments,
          functionArguments: payload.functionArguments
        },
        options: { maxGasAmount: 100000 },
      });
      toast({ 
        title: "Success", 
        description: `Transaction hash: ${response.hash.slice(0, 6)}...${response.hash.slice(-4)}`,
        action: (
          <ToastAction altText="View in Explorer" onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${response.hash}?network=mainnet`, '_blank')}>
            View in Explorer
          </ToastAction>
        ),
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to claim rewards", variant: "destructive" });
    } finally {
      setIsClaiming(false);
    }
  };

  function getTokenAddress(info: any) {
    return info?.assetType || info?.coinType || info?.tokenAddress || info?.faType || null;
  }

  // Remove Liquidity
  const handleRemoveLiquidity = async () => {
    setShowRemoveModal(true);
  };

  const handleConfirmRemove = async () => {
    if (!signAndSubmitTransaction || !account?.address) return;
    try {
      setIsRemoving(true);
      setShowRemoveModal(false);
      const token1Info = position.position.pool.token1Info;
      const token2Info = position.position.pool.token2Info;
      const currencyA = getTokenAddress(token1Info);
      const currencyB = getTokenAddress(token2Info);
      console.log('REMOVE PARAMS:', {
        positionId: position.position.objectId,
        token1Info,
        token2Info,
        currencyA,
        currencyB,
        accountAddress: account.address.toString(),
      });
      if (!currencyA || !currencyB) {
        toast({ title: "Error", description: "Token address not found", variant: "destructive" });
        setIsRemoving(false);
        return;
      }
      const payload = await getRemoveLiquidityPayload({
        positionId: position.position.objectId,
        currencyA,
        currencyB,
        accountAddress: account.address.toString(),
      });
      console.log('REMOVE PAYLOAD:', payload);
      const response = await signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.typeArguments,
          functionArguments: payload.functionArguments
        },
        options: { maxGasAmount: 100000 },
      });
      toast({
        title: "Remove Liquidity Success",
        description: `Transaction hash: ${response.hash.slice(0, 6)}...${response.hash.slice(-4)}`,
        action: (
          <ToastAction altText="View in Explorer" onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${response.hash}?network=mainnet`, '_blank')}>
            View in Explorer
          </ToastAction>
        ),
      });
      // Обновляем позиции после успеха
      window.dispatchEvent(new CustomEvent('refreshPositions', { detail: { protocol: 'hyperion' } }));
    } catch (error) {
      console.error('Remove liquidity error:', error);
      toast({ title: "Error", description: "Failed to remove liquidity", variant: "destructive" });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div key={`${position.assetName}-${index}`} className="p-4 border-b last:border-b-0">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          {/* Логотипы токенов */}
          {position.position?.pool?.token1Info?.logoUrl && position.position?.pool?.token2Info?.logoUrl && (
            <div className="flex -space-x-2 mr-2">
              <img src={position.position.pool.token1Info.logoUrl} alt={position.position.pool.token1Info.symbol} className="w-8 h-8 rounded-full border-2 border-white object-contain" />
              <img src={position.position.pool.token2Info.logoUrl} alt={position.position.pool.token2Info.symbol} className="w-8 h-8 rounded-full border-2 border-white object-contain" />
            </div>
          )}
          <span className="text-lg font-semibold">{position.position?.pool?.token1Info?.symbol} / {position.position?.pool?.token2Info?.symbol}</span>
          <TooltipProvider>
            {position.isActive ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="px-2 py-1 rounded bg-green-500/10 text-green-600 text-xs font-semibold ml-2 cursor-help">Active</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>You are earning fees and rewards from this position</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="px-2 py-1 rounded bg-red-500/10 text-red-600 border-red-500/20 text-xs font-semibold ml-2 cursor-help">Inactive</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This position is not earning fees or rewards</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">${parseFloat(position.value || "0").toFixed(2)}</span>
        </div>
      </div>
      {/* Награды */}
      {(position.farm?.unclaimed?.length > 0 || position.fees?.unclaimed?.length > 0) && (
        <div className="flex flex-col items-end gap-1 mb-2">
          {position.farm?.unclaimed?.length > 0 && (
            <span className="text-base">💰 Farm rewards: ${farmRewards.toFixed(2)}</span>
          )}
          {position.fees?.unclaimed?.length > 0 && (
            <span className="text-base">💸 Fee rewards: ${feeRewards.toFixed(2)}</span>
          )}
          {totalRewards > 0 && (
            <button
              className="px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold disabled:opacity-60"
              onClick={handleClaimRewards}
              disabled={isClaiming}
            >
              {isClaiming ? 'Claiming...' : 'Claim'}
            </button>
          )}
        </div>
      )}
      
      {/* Кнопка Remove для всех позиций */}
      <div className="flex justify-end mt-2">
        <button
          className={`px-3 py-1 rounded text-sm font-semibold disabled:opacity-60 transition-all ${
            position.isActive 
              ? 'bg-red-300 text-red-800 hover:bg-red-400 border border-red-400' 
              : 'bg-red-500 text-white hover:bg-red-600 shadow-lg'
          }`}
          onClick={handleRemoveLiquidity}
          disabled={isRemoving || !getTokenAddress(position.position.pool.token1Info) || !getTokenAddress(position.position.pool.token2Info)}
        >
          {isRemoving ? 'Removing...' : 'Remove'}
        </button>
      </div>

      {/* Модальное окно подтверждения */}
      <ConfirmRemoveModal
        isOpen={showRemoveModal}
        onClose={() => setShowRemoveModal(false)}
        onConfirm={handleConfirmRemove}
        isLoading={isRemoving}
        position={position}
      />
    </div>
  );
}

export function HyperionPositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPositions = async () => {
    if (!account?.address) {
      setPositions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/protocols/hyperion/userPositions?address=${account.address}`);
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        // Сортируем позиции по сумме ликвидности
        const sortedPositions = [...data.data].sort((a, b) => {
          const valueA = parseFloat(a.value || "0");
          const valueB = parseFloat(b.value || "0");
          return valueB - valueA;
        });
        setPositions(sortedPositions);
      } else {
        setPositions([]);
      }
    } catch (err) {
      console.error('Error loading Hyperion positions:', err);
      setError('Failed to load positions');
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPositions();

    // Добавляем обработчик события обновления
    const handleRefresh = (event: CustomEvent) => {
      if (event.detail.protocol === 'hyperion') {
        // Сортируем позиции при обновлении
        const sortedPositions = [...event.detail.data].sort((a, b) => {
          const valueA = parseFloat(a.value || "0");
          const valueB = parseFloat(b.value || "0");
          return valueB - valueA;
        });
        setPositions(sortedPositions);
      }
    };

    window.addEventListener('refreshPositions', handleRefresh as EventListener);
    return () => {
      window.removeEventListener('refreshPositions', handleRefresh as EventListener);
    };
  }, [account?.address]);

  // Считаем общую сумму (позиции + награды)
  const totalValue = positions.reduce((sum, position) => {
    const positionValue = parseFloat(position.value || "0");
    const farmRewards = position.farm?.unclaimed?.reduce((rewardSum: number, reward: { amountUSD: string }) => {
      return rewardSum + parseFloat(reward.amountUSD || "0");
    }, 0) || 0;
    const feeRewards = position.fees?.unclaimed?.reduce((feeSum: number, fee: { amountUSD: string }) => {
      return feeSum + parseFloat(fee.amountUSD || "0");
    }, 0) || 0;
    return sum + positionValue + farmRewards + feeRewards;
  }, 0);

  if (loading) {
    return <div>Loading positions...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (positions.length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-6 py-2 px-6">
      <div className="space-y-4 text-base">
        {positions.map((position, index) => (
          <HyperionPosition key={`${position.assetName}-${index}`} position={position} index={index} />
        ))}
        <div className="flex items-center justify-between pt-6 pb-6">
          <span className="text-xl">Total assets in Hyperion:</span>
          <span className="text-xl text-primary font-bold">${totalValue.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
} 