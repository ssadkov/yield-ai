'use client';

import { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { sdk } from "@/lib/hyperion";
import { getRemoveLiquidityPayload } from "@/lib/services/protocols/hyperion/pools";
import { ConfirmRemoveModal } from "@/components/ui/confirm-remove-modal";
import { ClaimAllRewardsModal } from "@/components/ui/claim-all-rewards-modal";
import { WithdrawModal } from "@/components/ui/withdraw-modal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { filterHyperionVaultTokens, getVaultTokenMapping } from '@/lib/services/hyperion/vaultTokens';
import { VaultCalculator, VaultData } from '@/lib/services/hyperion/vaultCalculator';
import { VaultPosition } from "./VaultPosition";
import { Token } from '@/lib/types/token';
import { AptosPortfolioService } from '@/lib/services/aptos/portfolio';
import { useWithdraw } from "@/lib/hooks/useWithdraw";
import { ProtocolKey } from "@/lib/transactions/types";

interface HyperionPositionProps {
  position: any;
  index: number;
}

const HyperionPosition = memo(function HyperionPosition({ position, index }: HyperionPositionProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showPoolDetails, setShowPoolDetails] = useState(false);
  const [poolDetails, setPoolDetails] = useState<any>(null);
  const [loadingPoolDetails, setLoadingPoolDetails] = useState(false);
  const [poolAPR, setPoolAPR] = useState({ feeAPR: 0, farmAPR: 0 });
  const { signAndSubmitTransaction, account } = useWallet();
  const { toast } = useToast();

  // Добавляем уникальный идентификатор компонента
  const componentId = useMemo(() => `hyperion-${position.position?.objectId}-${index}`, [position.position?.objectId, index]);

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
        options: { maxGasAmount: 20000 }, // Network limit is 20000
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
    console.log('HyperionPosition: handleRemoveLiquidity called for component', componentId);
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
        options: { maxGasAmount: 20000 }, // Network limit is 20000
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
      }, 2000);
    } catch (error) {
      console.error('Remove liquidity error:', error);
      toast({ title: "Error", description: "Failed to remove liquidity", variant: "destructive" });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="p-4 border-b last:border-b-0">
      {/* Desktop layout */}
      <div className="hidden md:flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {/* Значки токенов слева как в TappExchange */}
            {position.position?.pool?.token1Info?.logoUrl && position.position?.pool?.token2Info?.logoUrl && (
              <div className="flex -space-x-2 mr-2">
                <img 
                  src={position.position.pool.token1Info.logoUrl} 
                  alt={position.position.pool.token1Info.symbol} 
                  className="w-8 h-8 rounded-full border-2 border-white object-contain"
                />
                <img 
                  src={position.position.pool.token2Info.logoUrl} 
                  alt={position.position.pool.token2Info.symbol} 
                  className="w-8 h-8 rounded-full border-2 border-white object-contain"
                />
              </div>
            )}
            <span className="text-lg font-semibold">
              {position.position?.pool?.token1Info?.symbol || 'Unknown'} / {position.position?.pool?.token2Info?.symbol || 'Unknown'}
            </span>
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
                    <Badge variant="outline" className="bg-error-muted text-error border-error/20 text-xs font-normal px-2 py-0.5 h-5 ml-2 cursor-help">
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
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {/* APR и сумма справа */}
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
            <span className="text-lg font-bold text-right w-24">${parseFloat(position.value || "0").toFixed(2)}</span>
          </div>
          
          {/* Rewards с tooltip */}
          {(position.farm?.unclaimed?.length > 0 || position.fees?.unclaimed?.length > 0) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-sm text-gray-600 cursor-help">
                    💰 Rewards: ${totalRewards.toFixed(2)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p className="font-medium">Rewards Breakdown</p>
                    {position.farm?.unclaimed?.length > 0 && (
                      <p className="text-xs">💰 Farm rewards: ${farmRewards.toFixed(2)}</p>
                    )}
                    {position.fees?.unclaimed?.length > 0 && (
                      <p className="text-xs">💸 Fee rewards: ${feeRewards.toFixed(2)}</p>
                    )}
                    <p className="text-xs font-semibold">Total: ${totalRewards.toFixed(2)}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {/* Кнопки Claim и Remove */}
          <div className="flex gap-2">
            {totalRewards > 0 && (
              <button
                className="px-3 py-1 bg-success text-success-foreground rounded text-sm font-semibold disabled:opacity-60"
                onClick={handleClaimRewards}
                disabled={isClaiming}
              >
                {isClaiming ? 'Claiming...' : 'Claim'}
              </button>
            )}
            <button
              className={`px-3 py-1 rounded text-sm font-semibold disabled:opacity-60 transition-all ${
                position.isActive 
                  ? 'bg-error-muted text-error hover:bg-error-muted/80 border border-error/20' 
                  : 'bg-error text-error-foreground hover:bg-error/90 shadow-lg'
              }`}
              onClick={handleRemoveLiquidity}
              disabled={isRemoving || !getTokenAddress(position.position.pool.token1Info) || !getTokenAddress(position.position.pool.token2Info)}
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden space-y-3">
        {/* Header с токенами и статусом */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {position.position?.pool?.token1Info?.logoUrl && position.position?.pool?.token2Info?.logoUrl && (
              <div className="flex -space-x-2 mr-2">
                <img 
                  src={position.position.pool.token1Info.logoUrl} 
                  alt={position.position.pool.token1Info.symbol} 
                  className="w-8 h-8 rounded-full border-2 border-white object-contain"
                />
                <img 
                  src={position.position.pool.token2Info.logoUrl} 
                  alt={position.position.pool.token2Info.symbol} 
                  className="w-8 h-8 rounded-full border-2 border-white object-contain"
                />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-lg font-semibold">
                {position.position?.pool?.token1Info?.symbol || 'Unknown'} / {position.position?.pool?.token2Info?.symbol || 'Unknown'}
              </span>
              <div className="flex items-center gap-2 mt-1">
                {position.isActive ? (
                  <Badge variant="outline" className="bg-success-muted text-success border-success/20 text-xs font-normal px-2 py-0.5 h-5">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-error-muted text-error border-error/20 text-xs font-normal px-2 py-0.5 h-5">
                    Inactive
                  </Badge>
                )}
                <button
                  className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-200/60 focus:outline-none transition-colors"
                  onClick={handleViewPoolDetails}
                  disabled={loadingPoolDetails}
                  aria-label="Pool details"
                  type="button"
                >
                  <Info className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-right w-24">${parseFloat(position.value || "0").toFixed(2)}</span>
          </div>
        </div>

        {/* APR и Rewards */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-2 py-0.5 h-5">
              APR: {totalAPR.toFixed(2)}%
            </Badge>
            <span className="text-xs text-gray-500">
              Fee: {poolAPR.feeAPR.toFixed(2)}% | Farm: {poolAPR.farmAPR.toFixed(2)}%
            </span>
          </div>
          {(position.farm?.unclaimed?.length > 0 || position.fees?.unclaimed?.length > 0) && (
            <div className="text-sm text-gray-600">
              💰 ${totalRewards.toFixed(2)}
            </div>
          )}
        </div>

        {/* Кнопки действий */}
        <div className="flex gap-2">
          {totalRewards > 0 && (
            <button
              className="flex-1 py-2 bg-success text-success-foreground rounded text-sm font-semibold disabled:opacity-60"
              onClick={handleClaimRewards}
              disabled={isClaiming}
            >
              {isClaiming ? 'Claiming...' : 'Claim Rewards'}
            </button>
          )}
          <button
            className={`flex-1 py-2 rounded text-sm font-semibold disabled:opacity-60 transition-all ${
              position.isActive 
                ? 'bg-error-muted text-error hover:bg-error-muted/80 border border-error/20' 
                : 'bg-error text-error-foreground hover:bg-error/90 shadow-lg'
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

      {/* Модальное окно с деталями пула */}
      {showPoolDetails && poolDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Pool Details</h2>
              <button
                onClick={() => setShowPoolDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              {poolDetails.map((pool: any, index: number) => {
                const { feeAPR, farmAPR, tvlUSD, dailyVolumeUSD, feesUSD } = pool;
                return (
                  <div key={index} className="border rounded p-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-700">Fee APR</h3>
                        <p className="text-sm">{feeAPR || "0"}%</p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-700">Farm APR</h3>
                        <p className="text-sm">{farmAPR || "0"}%</p>
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
                        {JSON.stringify(pool, null, 2)}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export function HyperionPositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [vaultTokens, setVaultTokens] = useState<Token[]>([]);
  const [vaultData, setVaultData] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClaimAllModal, setShowClaimAllModal] = useState(false);
  const [showVaultWithdrawModal, setShowVaultWithdrawModal] = useState(false);
  const [selectedVaultToken, setSelectedVaultToken] = useState<Token | null>(null);
  const [selectedVaultData, setSelectedVaultData] = useState<VaultData | null>(null);
  const { withdraw, isLoading: isWithdrawing } = useWithdraw();

  const loadPositions = async () => {
    console.log('[HyperionPositions] loadPositions called');
    if (!account?.address) {
      console.log('[HyperionPositions] No account address');
      setPositions([]);
      setVaultTokens([]);
      setVaultData([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Загружаем обычные позиции
      console.log('[HyperionPositions] Fetching:', `/api/protocols/hyperion/userPositions?address=${account.address}`);
      const response = await fetch(`/api/protocols/hyperion/userPositions?address=${account.address}`);
      console.log('[HyperionPositions] Response status:', response.status);
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      const data = await response.json();
      console.log('[HyperionPositions] Response data:', data);
      if (data.success && Array.isArray(data.data)) {
        // Проверяем дубликаты
        const positionIds = data.data.map((p: any) => p.position?.objectId);
        const duplicates = positionIds.filter((id: string, index: number) => positionIds.indexOf(id) !== index);
        console.log('HyperionPositions: Raw data analysis', {
          total: data.data.length,
          positionIds: positionIds,
          duplicates: duplicates,
          hasDuplicates: duplicates.length > 0
        });
        // Удаляем дубликаты по positionId с более строгой проверкой
        const seenIds = new Set<string>();
        const uniquePositions = data.data.filter((position: any) => {
          const positionId = position.position?.objectId;
          if (!positionId || seenIds.has(positionId)) {
            return false;
          }
          seenIds.add(positionId);
          return true;
        });
        console.log('HyperionPositions: After deduplication', {
          total: data.data.length,
          unique: uniquePositions.length,
          duplicates: data.data.length - uniquePositions.length,
          uniquePositionIds: uniquePositions.map((p: any) => p.position?.objectId)
        });
        // Сортируем позиции по сумме ликвидности
        const sortedPositions = [...uniquePositions].sort((a, b) => {
          const valueA = parseFloat(a.value || "0");
          const valueB = parseFloat(b.value || "0");
          return valueB - valueA;
        });
        setPositions(sortedPositions);
      } else {
        console.log('[HyperionPositions] No valid data, setting positions to []');
        setPositions([]);
      }

      // Загружаем токены кошелька для поиска Vault токенов
      console.log('[HyperionPositions] Fetching wallet tokens for Vault detection');
      const portfolioService = new AptosPortfolioService();
      const walletData = await portfolioService.getPortfolio(account.address.toString());
      console.log('[HyperionPositions] Wallet data received:', walletData);
      if (walletData.tokens && Array.isArray(walletData.tokens)) {
        console.log('[HyperionPositions] Total tokens found:', walletData.tokens.length);
        const vaultTokensList = filterHyperionVaultTokens(walletData.tokens);
        setVaultTokens(vaultTokensList);
        console.log('[HyperionPositions] Vault tokens found:', vaultTokensList.length);
        console.log('[HyperionPositions] Vault token addresses:', vaultTokensList.map(t => t.address));

        // Загружаем данные Vault токенов
        if (vaultTokensList.length > 0) {
          const calculator = new VaultCalculator();
          const vaultTokenAddresses = vaultTokensList.map(token => token.address);
          const vaultDataResult = await calculator.getAllVaultData(vaultTokenAddresses, account.address.toString());
          setVaultData(vaultDataResult);
          console.log('[HyperionPositions] Vault data loaded:', vaultDataResult);
        }
      }

    } catch (err) {
      console.error('[HyperionPositions] Error loading positions:', err);
      setError('Failed to load positions');
      setPositions([]);
      setVaultTokens([]);
      setVaultData([]);
    } finally {
      setLoading(false);
      console.log('[HyperionPositions] Loading set to false');
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

  // Считаем позиции с наградами
  const positionsWithRewards = positions.filter(position => {
    const farmRewards = position.farm?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
    const feeRewards = position.fees?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
    return (farmRewards + feeRewards) > 0;
  });

  // Считаем общую сумму rewards
  const totalRewards = positions.reduce((sum, position) => {
    const farmRewards = position.farm?.unclaimed?.reduce((rewardSum: number, reward: { amountUSD: string }) => {
      return rewardSum + parseFloat(reward.amountUSD || "0");
    }, 0) || 0;
    const feeRewards = position.fees?.unclaimed?.reduce((feeSum: number, fee: { amountUSD: string }) => {
      return feeSum + parseFloat(fee.amountUSD || "0");
    }, 0) || 0;
    return sum + farmRewards + feeRewards;
  }, 0);

  // Считаем общую сумму (позиции + награды + Vault токены)
  const totalValue = positions.reduce((sum, position) => {
    const positionValue = parseFloat(position.value || "0");
    const farmRewards = position.farm?.unclaimed?.reduce((rewardSum: number, reward: { amountUSD: string }) => {
      return rewardSum + parseFloat(reward.amountUSD || "0");
    }, 0) || 0;
    const feeRewards = position.fees?.unclaimed?.reduce((feeSum: number, fee: { amountUSD: string }) => {
      return feeSum + parseFloat(fee.amountUSD || "0");
    }, 0) || 0;
    return sum + positionValue + farmRewards + feeRewards;
  }, 0) + vaultData.reduce((sum, vaultInfo) => sum + (vaultInfo.totalValueUSD || 0), 0);

  if (loading) {
    return <div>Loading positions...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (positions.length === 0 && vaultData.length === 0) {
    console.log('[HyperionPositions] No positions or vault data, returning null');
    return null;
  }

  console.log('[HyperionPositions] Rendering with:', {
    positionsCount: positions.length,
    vaultDataCount: vaultData.length,
    totalValue
  });

  // Handler для открытия модала Vault Withdraw
  const handleVaultWithdraw = (vaultToken: Token, vaultDataItem: VaultData) => {
    console.log('[HyperionPositions] Opening Vault Withdraw modal:', { vaultToken, vaultDataItem });
    setSelectedVaultToken(vaultToken);
    setSelectedVaultData(vaultDataItem);
    setShowVaultWithdrawModal(true);
  };

  // Handler для подтверждения Vault Withdraw
  const handleVaultWithdrawConfirm = async (amount: bigint) => {
    if (!selectedVaultToken || !account?.address) {
      console.error('[HyperionPositions] Missing data for vault withdraw');
      return;
    }

    try {
      console.log('[HyperionPositions] Executing Vault Withdraw:', {
        vaultTokenAddress: selectedVaultToken.address,
        amount: amount.toString(),
        walletAddress: account.address.toString()
      });

      await withdraw(
        'hyperion' as ProtocolKey,
        selectedVaultToken.address, // marketAddress (vault token address / poolId)
        amount, // amount of vault tokens to withdraw
        selectedVaultToken.address // token address
      );

      // Закрываем модал и сбрасываем выбранные данные
      setShowVaultWithdrawModal(false);
      setSelectedVaultToken(null);
      setSelectedVaultData(null);

      // Обновляем позиции после успешного withdraw
      setTimeout(() => {
        memoizedLoadPositions();
      }, 2000);
    } catch (error) {
      console.error('[HyperionPositions] Vault Withdraw error:', error);
      // Ошибка уже обработана в useWithdraw hook
    }
  };

  return (
    <div className="w-full mb-6 py-2">
      <div className="space-y-4 text-base">
        {/* Смешиваем обычные позиции и Vault позиции */}
        {(() => {
          const allPositions = [
            // Обычные позиции
            ...positions.map((position, index) => ({
              type: 'position' as const,
              data: position,
              index,
              value: parseFloat(position.value || "0")
            })),
            // Vault позиции
            ...vaultData.map((vaultInfo, index) => ({
              type: 'vault' as const,
              data: vaultInfo,
              index,
              value: vaultInfo.totalValueUSD
            }))
          ];
          
          console.log('[HyperionPositions] All positions before sorting:', allPositions);
          const sortedPositions = allPositions.sort((a, b) => b.value - a.value);
          console.log('[HyperionPositions] Sorted positions:', sortedPositions);
          
          return sortedPositions.map((item, displayIndex) => {
            if (item.type === 'position') {
              return (
                <HyperionPosition 
                  key={`hyperion-${item.data.position?.objectId}-${item.index}`} 
                  position={item.data} 
                  index={item.index} 
                />
              );
            } else {
              // Находим соответствующий Vault токен
              const vaultToken = vaultTokens.find(token => token.address === item.data.vaultTokenAddress);
              if (!vaultToken) {
                console.log('[HyperionPositions] Vault token not found for:', item.data.vaultTokenAddress);
                return null;
              }
              
              console.log('[HyperionPositions] Rendering Vault position:', item.data);
              return (
                <VaultPosition
                  key={`vault-${item.data.vaultTokenAddress}-${item.index}`}
                  vaultToken={vaultToken}
                  vaultData={item.data}
                  index={item.index}
                  onWithdraw={() => handleVaultWithdraw(vaultToken, item.data)}
                />
              );
            }
          });
        })()}
        <div className="pt-6 pb-6">
          {/* Desktop layout */}
          <div className="hidden md:block">
            <div className="flex items-center justify-between">
              <span className="text-xl">Total assets in Hyperion:</span>
              <span className="text-xl text-primary font-bold">${totalValue.toFixed(2)}</span>
            </div>
            {totalRewards > 0 && (
              <div className="flex justify-end mt-2">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                    <span>💰</span>
                    <span>including rewards ${totalRewards.toFixed(2)}</span>
                  </div>
                  {positionsWithRewards.length > 1 && (
                    <button
                      className="px-3 py-1 bg-success text-success-foreground rounded text-sm font-semibold disabled:opacity-60 mt-1"
                      onClick={() => setShowClaimAllModal(true)}
                    >
                      Claim All Rewards ({positionsWithRewards.length})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile layout */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-lg">Total assets in Hyperion:</span>
              <span className="text-lg text-primary font-bold">${totalValue.toFixed(2)}</span>
            </div>
            {totalRewards > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <span>💰</span>
                  <span>including rewards ${totalRewards.toFixed(2)}</span>
                </div>
                {positionsWithRewards.length > 1 && (
                  <button
                    className="w-full py-2 bg-success text-success-foreground rounded text-sm font-semibold disabled:opacity-60"
                    onClick={() => setShowClaimAllModal(true)}
                  >
                    Claim All Rewards ({positionsWithRewards.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Модальное окно для Claim All Rewards */}
      <ClaimAllRewardsModal
        isOpen={showClaimAllModal}
        onClose={() => setShowClaimAllModal(false)}
        summary={{
          totalValue: totalRewards,
          protocols: {
            echelon: { value: 0, count: 0 },
            auro: { value: 0, count: 0 },
            hyperion: {
              count: positionsWithRewards.length,
              value: totalRewards
            },
            meso: { value: 0, count: 0 },
            earnium: { value: 0, count: 0 },
            moar: { value: 0, count: 0 }
          }
        }}
        positions={positions}
      />

      {/* Модальное окно для Vault Withdraw */}
      {selectedVaultToken && selectedVaultData && (
        <WithdrawModal
          isOpen={showVaultWithdrawModal}
          onClose={() => {
            setShowVaultWithdrawModal(false);
            setSelectedVaultToken(null);
            setSelectedVaultData(null);
          }}
          onConfirm={handleVaultWithdrawConfirm}
          position={{
            coin: selectedVaultToken.address,
            supply: selectedVaultToken.amount || "0",
            market: selectedVaultToken.address
          }}
          tokenInfo={{
            symbol: (() => {
              const vaultMapping = getVaultTokenMapping(selectedVaultToken.address);
              const token1 = vaultMapping?.tokens[0];
              const token2 = vaultMapping?.tokens[1];
              return `Goblin ${token1?.symbol || 'Unknown'}/${token2?.symbol || 'Unknown'}`;
            })(),
            logoUrl: (() => {
              const vaultMapping = getVaultTokenMapping(selectedVaultToken.address);
              return vaultMapping?.tokens[0]?.logoUrl;
            })(),
            decimals: 8,
            usdPrice: (() => {
              // Рассчитываем USD цену за 1 vault token
              const vaultAmount = parseFloat(selectedVaultToken.amount || "0");
              if (vaultAmount === 0) return "0";
              const usdValue = selectedVaultData.totalValueUSD;
              const pricePerToken = usdValue / (vaultAmount / Math.pow(10, 8));
              return pricePerToken.toString();
            })()
          }}
          isLoading={isWithdrawing}
          userAddress={account?.address?.toString()}
        />
      )}
    </div>
  );
} 