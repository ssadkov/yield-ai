import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { sdk } from "@/lib/hyperion";
import { X, CheckCircle, AlertCircle } from "lucide-react";

interface ClaimAllRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions: any[];
}

interface ClaimResult {
  positionId: string;
  success: boolean;
  hash?: string;
  error?: string;
}

export function ClaimAllRewardsModal({ isOpen, onClose, positions }: ClaimAllRewardsModalProps) {
  const { signAndSubmitTransaction, account } = useWallet();
  const { toast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ClaimResult[]>([]);
  const [currentHash, setCurrentHash] = useState<string>("");

  // Фильтруем позиции с наградами
  const positionsWithRewards = positions.filter(position => {
    const farmRewards = position.farm?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
    const feeRewards = position.fees?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
    return (farmRewards + feeRewards) > 0;
  });

  const totalPositions = positionsWithRewards.length;
  const progress = totalPositions > 0 ? ((currentIndex + 1) / totalPositions) * 100 : 0;

  // Считаем общую сумму наград
  const totalRewardsValue = positionsWithRewards.reduce((sum, position) => {
    const farmRewards = position.farm?.unclaimed?.reduce((rewardSum: number, reward: { amountUSD: string }) => {
      return rewardSum + parseFloat(reward.amountUSD || "0");
    }, 0) || 0;
    const feeRewards = position.fees?.unclaimed?.reduce((feeSum: number, fee: { amountUSD: string }) => {
      return feeSum + parseFloat(fee.amountUSD || "0");
    }, 0) || 0;
    return sum + farmRewards + feeRewards;
  }, 0);

  const handleClaimAll = async () => {
    if (!signAndSubmitTransaction || !account?.address || totalPositions === 0) return;

    setIsClaiming(true);
    setCurrentIndex(0);
    setResults([]);
    setCurrentHash("");

    for (let i = 0; i < totalPositions; i++) {
      const position = positionsWithRewards[i];
      setCurrentIndex(i);
      setCurrentHash("");

      try {
        // Создаем payload для claim
        const payload = await sdk.Position.claimAllRewardsTransactionPayload({
          positionId: position.position.objectId,
          recipient: account.address.toString()
        });

        // Отправляем транзакцию
        const response = await signAndSubmitTransaction({
          data: {
            function: payload.function as `${string}::${string}::${string}`,
            typeArguments: payload.typeArguments,
            functionArguments: payload.functionArguments
          },
          options: { maxGasAmount: 100000 },
        });

        setCurrentHash(response.hash);

        // Ждем подтверждения транзакции
        const maxAttempts = 10;
        const delay = 2000;
        let success = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const txResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${response.hash}`);
            const txData = await txResponse.json();
            
            if (txData.success && txData.vm_status === 'Executed successfully') {
              success = true;
              break;
            } else if (txData.vm_status && txData.vm_status !== 'Executed successfully') {
              throw new Error(`Transaction failed: ${txData.vm_status}`);
            }
          } catch (error) {
            // Продолжаем попытки
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (success) {
          setResults(prev => [...prev, {
            positionId: position.position.objectId,
            success: true,
            hash: response.hash
          }]);
        } else {
          throw new Error('Transaction timeout');
        }

      } catch (error) {
        setResults(prev => [...prev, {
          positionId: position.position.objectId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }]);
      }

      // Небольшая пауза между транзакциями
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsClaiming(false);

    // Показываем итоговый результат
    const successfulClaims = results.filter(r => r.success).length;
    const failedClaims = results.filter(r => !r.success).length;

    if (successfulClaims > 0) {
      toast({
        title: "Claim All Rewards Completed",
        description: `Successfully claimed ${successfulClaims} positions${failedClaims > 0 ? `, ${failedClaims} failed` : ''}`,
      });
    }

    if (failedClaims > 0) {
      toast({
        title: "Some Claims Failed",
        description: `${failedClaims} positions failed to claim. Check the results below.`,
        variant: "destructive"
      });
    }

    // Обновляем позиции
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('refreshPositions', { detail: { protocol: 'hyperion' } }));
    }, 2000);
  };

  const handleClose = () => {
    if (!isClaiming) {
      onClose();
    }
  };

  const getCurrentPositionInfo = () => {
    if (currentIndex < totalPositions) {
      const position = positionsWithRewards[currentIndex];
      const farmRewards = position.farm?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
      const feeRewards = position.fees?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
      const totalRewards = farmRewards + feeRewards;
      
      return {
        symbol: `${position.position?.pool?.token1Info?.symbol || 'Unknown'}/${position.position?.pool?.token2Info?.symbol || 'Unknown'}`,
        rewards: totalRewards
      };
    }
    return null;
  };

  const currentPosition = getCurrentPositionInfo();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Claim All Rewards</span>
            {!isClaiming && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Общая информация */}
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">${totalRewardsValue.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">
              Total rewards across {totalPositions} positions
            </div>
          </div>

          {/* Прогресс */}
          {isClaiming && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{currentIndex + 1} of {totalPositions}</span>
              </div>
              <Progress value={progress} className="w-full" />
              
              {currentPosition && (
                <div className="text-center text-sm">
                  <div>Claiming: {currentPosition.symbol}</div>
                  <div className="text-muted-foreground">${currentPosition.rewards.toFixed(2)}</div>
                </div>
              )}

              {currentHash && (
                <div className="text-center text-xs text-muted-foreground">
                  <div>Transaction hash:</div>
                  <div className="font-mono">
                    {currentHash.slice(0, 6)}...{currentHash.slice(-4)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Результаты */}
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Results:</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {results.map((result, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    {result.success ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className="font-mono">
                      {result.positionId.slice(0, 6)}...{result.positionId.slice(-4)}
                    </span>
                    {result.success ? (
                      <span className="text-green-600">Success</span>
                    ) : (
                      <span className="text-red-600">{result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex justify-end gap-2">
            {!isClaiming && results.length === 0 && (
              <Button onClick={handleClaimAll} className="bg-green-600 hover:bg-green-700">
                Start Claiming
              </Button>
            )}
            {!isClaiming && results.length > 0 && (
              <Button onClick={handleClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 