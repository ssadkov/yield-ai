'use client';

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { sdk } from "@/lib/hyperion";
import { getRemoveLiquidityPayload } from "@/lib/services/protocols/hyperion/pools";
import { ConfirmRemoveModal } from "@/components/ui/confirm-remove-modal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface HyperionPositionProps {
  position: any;
  index: number;
}

function HyperionPosition({ position, index }: HyperionPositionProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showPoolDetails, setShowPoolDetails] = useState(false);
  const [poolDetails, setPoolDetails] = useState<any>(null);
  const [loadingPoolDetails, setLoadingPoolDetails] = useState(false);
  const [poolAPR, setPoolAPR] = useState({ feeAPR: 0, farmAPR: 0 });
  const { signAndSubmitTransaction, account } = useWallet();
  const { toast } = useToast();

  // Считаем награды
  const farmRewards = position.farm?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
  const feeRewards = position.fees?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
  const totalRewards = farmRewards + feeRewards;

  // Получаем poolId из позиции
  const poolId = position.position?.pool?.poolId;

  // Загружаем APR из пула при изменении poolId
  useEffect(() => {
    async function fetchPoolAPR() {
      if (!poolId) return;
      
      try {
        const response = await fetch(`/api/protocols/hyperion/pools/${poolId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setPoolAPR({
              feeAPR: parseFloat(data.data[0].feeAPR || "0"),
              farmAPR: parseFloat(data.data[0].farmAPR || "0"),
            });
          }
        }
      } catch (error) {
        console.error('Error fetching pool APR:', error);
      }
    }

    fetchPoolAPR();
  }, [poolId]);

  // Считаем общий APR
  const totalAPR = poolAPR.feeAPR + poolAPR.farmAPR;

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

  // Load pool details by ID
  const handleViewPoolDetails = async () => {
    if (!position.position?.pool?.poolId) {
      toast({ title: "Error", description: "Pool ID not found", variant: "destructive" });
      return;
    }

    try {
      setLoadingPoolDetails(true);
      const response = await fetch(`/api/protocols/hyperion/pools/${position.position.pool.poolId}`);
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setPoolDetails(data.data);
        setShowPoolDetails(true);
      } else {
        toast({ title: "Error", description: "Failed to load pool details", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error loading pool details:', error);
      toast({ title: "Error", description: "Failed to load pool details", variant: "destructive" });
    } finally {
      setLoadingPoolDetails(false);
    }
  };

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
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshPositions', { detail: { protocol: 'hyperion' } }));
      }, 2000); // Небольшая задержка для обновления блокчейна
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
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5 ml-2 cursor-help">
                    Active
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>You are earning fees and rewards from this position</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs font-normal px-2 py-0.5 h-5 ml-2 cursor-help">
                    Inactive
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This position is not earning fees or rewards</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-200/60 focus:outline-none transition-colors"
                  onClick={handleViewPoolDetails}
                  disabled={loadingPoolDetails}
                  aria-label="Pool details"
                  type="button"
                >
                  <Info className="w-4 h-4 text-gray-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <span>Pool details</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-2 py-0.5 h-5 cursor-help">
                  APR: {totalAPR.toFixed(2)}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">APR Breakdown</p>
                  <p className="text-xs">Fee APR: {poolAPR.feeAPR.toFixed(2)}%</p>
                  <p className="text-xs">Farm APR: {poolAPR.farmAPR.toFixed(2)}%</p>
                  <p className="text-xs font-semibold">Total APR: {totalAPR.toFixed(2)}%</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-lg font-bold">${parseFloat(position.value || "0").toFixed(2)}</span>
        </div>
      </div>
      {/* Награды и кнопки */}
      <div className="flex flex-col items-end gap-1 mb-2">
        {(position.farm?.unclaimed?.length > 0 || position.fees?.unclaimed?.length > 0) && (
          <>
            {position.farm?.unclaimed?.length > 0 && (
              <span className="text-base">💰 Farm rewards: ${farmRewards.toFixed(2)}</span>
            )}
            {position.fees?.unclaimed?.length > 0 && (
              <span className="text-base">💸 Fee rewards: ${feeRewards.toFixed(2)}</span>
            )}
          </>
        )}
        
        {/* Кнопки Claim и Remove */}
        <div className="flex gap-2 mt-1">
          {totalRewards > 0 && (
            <button
              className="px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold disabled:opacity-60"
              onClick={handleClaimRewards}
              disabled={isClaiming}
            >
              {isClaiming ? 'Claiming...' : 'Claim'}
            </button>
          )}
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
      </div>

      {/* Модальное окно подтверждения */}
      <ConfirmRemoveModal
        isOpen={showRemoveModal}
        onClose={() => setShowRemoveModal(false)}
        onConfirm={handleConfirmRemove}
        isLoading={isRemoving}
        position={position}
      />

      {/* Модальное окно деталей пула */}
      {showPoolDetails && poolDetails && (
        (() => {
          // Если poolDetails — массив, берём первый элемент
          const poolData = Array.isArray(poolDetails) ? poolDetails[0] : poolDetails;
          const { id, dailyVolumeUSD, feesUSD, tvlUSD, feeAPR, farmAPR, pool } = poolData;
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Pool Details</h2>
                  <button
                    onClick={() => setShowPoolDetails(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-700">Pool ID</h3>
                      <p className="text-sm font-mono break-all">{id}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700">Fee Tier</h3>
                      <p className="text-sm">{pool.feeTier}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700">Current Tick</h3>
                      <p className="text-sm">{pool.currentTick}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700">Sqrt Price</h3>
                      <p className="text-sm font-mono break-all">{pool.sqrtPrice}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700">Fee APR</h3>
                      <p className="text-sm text-green-600">{parseFloat(feeAPR || "0").toFixed(2)}%</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700">Farm APR</h3>
                      <p className="text-sm text-blue-600">{parseFloat(farmAPR || "0").toFixed(2)}%</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700">Total APR</h3>
                      <p className="text-sm font-bold text-purple-600">{(parseFloat(feeAPR || "0") + parseFloat(farmAPR || "0")).toFixed(2)}%</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700">TVL USD</h3>
                      <p className="text-sm">${parseFloat(tvlUSD || "0").toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700">Daily Volume USD</h3>
                      <p className="text-sm">${parseFloat(dailyVolumeUSD || "0").toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700">Fees USD (24h)</h3>
                      <p className="text-sm">${parseFloat(feesUSD || "0").toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">Token 1</h3>
                      <div className="bg-gray-50 p-3 rounded flex items-center gap-2">
                        {pool.token1Info?.logoUrl && <img src={pool.token1Info.logoUrl} alt={pool.token1Info.symbol} className="w-8 h-8 rounded-full object-contain" />}
                        <div>
                          <div className="font-bold">{pool.token1Info?.symbol}</div>
                          <div className="text-xs text-gray-500">{pool.token1Info?.name}</div>
                          <div className="text-xs font-mono break-all">{pool.token1}</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">Token 2</h3>
                      <div className="bg-gray-50 p-3 rounded flex items-center gap-2">
                        {pool.token2Info?.logoUrl && <img src={pool.token2Info.logoUrl} alt={pool.token2Info.symbol} className="w-8 h-8 rounded-full object-contain" />}
                        <div>
                          <div className="font-bold">{pool.token2Info?.symbol}</div>
                          <div className="text-xs text-gray-500">{pool.token2Info?.name}</div>
                          <div className="text-xs font-mono break-all">{pool.token2}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Raw Pool Data</h3>
                    <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(poolData, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}
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

  // Мемоизируем функцию loadPositions
  const memoizedLoadPositions = useCallback(loadPositions, [account?.address]);

  useEffect(() => {
    memoizedLoadPositions();

    // Добавляем обработчик события обновления
    const handleRefresh = (event: CustomEvent) => {
      if (event.detail.protocol === 'hyperion') {
        // Если есть данные в событии, используем их, иначе загружаем заново
        if (event.detail.data && Array.isArray(event.detail.data)) {
          // Сортируем позиции при обновлении
          const sortedPositions = [...event.detail.data].sort((a, b) => {
            const valueA = parseFloat(a.value || "0");
            const valueB = parseFloat(b.value || "0");
            return valueB - valueA;
          });
          setPositions(sortedPositions);
        } else {
          // Если данных нет, загружаем позиции заново
          memoizedLoadPositions();
        }
      }
    };

    window.addEventListener('refreshPositions', handleRefresh as EventListener);
    return () => {
      window.removeEventListener('refreshPositions', handleRefresh as EventListener);
    };
  }, [memoizedLoadPositions]);

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