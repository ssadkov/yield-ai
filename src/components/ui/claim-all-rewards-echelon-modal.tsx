import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { CheckCircle, AlertCircle } from "lucide-react";
import tokenList from "@/lib/data/tokenList.json";

interface EchelonReward {
  token: string;
  tokenType: string;
  rewardName?: string;
  amount: number;
  rawAmount: string;
  farmingId: string;
  stakeAmount: number;
}

interface ClaimResult {
  rewardKey: string;
  success: boolean;
  hash?: string;
  error?: string;
}

interface ClaimAllRewardsEchelonModalProps {
  isOpen: boolean;
  onClose: () => void;
  rewards: EchelonReward[];
  tokenPrices?: Record<string, string>;
}

export function ClaimAllRewardsEchelonModal({ isOpen, onClose, rewards, tokenPrices = {} }: ClaimAllRewardsEchelonModalProps) {
  const { signAndSubmitTransaction, account } = useWallet();
  const { toast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ClaimResult[]>([]);
  const [currentHash, setCurrentHash] = useState<string>("");

  // Фильтруем награды с положительным количеством
  const claimableRewards = rewards.filter(reward => reward.amount > 0);
  
  // Separate rewards for progress calculation
  const rewardsPoolRewards = claimableRewards.filter(r => r.farmingId === 'rewards_pool' && r.amount > 0);
  const farmingRewards = claimableRewards.filter(r => r.farmingId !== 'rewards_pool' && r.farmingId && r.tokenType && r.amount > 0);
  
  // Total transactions: 1 for rewards_pool (if any) + N for farming rewards
  const totalTransactions = (rewardsPoolRewards.length > 0 ? 1 : 0) + farmingRewards.length;
  const totalRewards = claimableRewards.length; // Total rewards count for display
  const progress = totalTransactions > 0 ? ((currentIndex + 1) / totalTransactions) * 100 : 0;

  // Функция для получения цены токена
  const getTokenPrice = (tokenAddress: string): string => {
    let cleanAddress = tokenAddress;
    if (cleanAddress.startsWith('@')) {
      cleanAddress = cleanAddress.slice(1);
    }
    if (!cleanAddress.startsWith('0x')) {
      cleanAddress = `0x${cleanAddress}`;
    }
    return tokenPrices[cleanAddress] || '0';
  };

  // Функция для получения информации о токене наград
  const getRewardTokenInfoHelper = (tokenSymbol: string) => {
    console.log('[ClaimModal] getRewardTokenInfoHelper called for:', tokenSymbol);
    
    const token = (tokenList as any).data.data.find((token: any) => 
      token.symbol.toLowerCase() === tokenSymbol.toLowerCase() ||
      token.name.toLowerCase().includes(tokenSymbol.toLowerCase())
    );
    
    console.log('[ClaimModal] Found token:', token);
    
    if (!token) {
      console.log('[ClaimModal] Token not found for symbol:', tokenSymbol);
      return undefined;
    }
    
    const result = {
      address: token.tokenAddress,
      faAddress: token.faAddress,
      symbol: token.symbol,
      icon_uri: token.logoUrl,
      decimals: token.decimals,
      price: null // Цена будет получена динамически
    };
    
    console.log('[ClaimModal] Returning token info:', result);
    return result;
  };

  // Считаем общую сумму наград в долларах
  const totalRewardsValue = claimableRewards.reduce((sum, reward) => {
    const tokenInfo = getRewardTokenInfoHelper(reward.token);
    if (!tokenInfo) return sum;
    
    const price = getTokenPrice(tokenInfo.faAddress || tokenInfo.address || '');
    const value = price && price !== '0' ? reward.amount * parseFloat(price) : 0;
    
    return sum + value;
  }, 0);

  const handleClaimAll = async () => {
    if (!signAndSubmitTransaction || !account?.address || totalRewards === 0) return;

    setIsClaiming(true);
    setCurrentIndex(0);
    setResults([]);
    setCurrentHash("");

    // Use already separated rewards

    let transactionIndex = 0;

    // Claim rewards_pool rewards with single claim_all_rewards transaction
    if (rewardsPoolRewards.length > 0) {
      setCurrentIndex(transactionIndex);
      setCurrentHash("");

      try {
        const REWARDS_POOL_ADDRESS = "0xfdb653ffa48e91f39396ce87c656406f9b5e7a6686475446d92e79b098f0f4b5";
        
        const txResponse = await signAndSubmitTransaction({
          data: {
            function: `${REWARDS_POOL_ADDRESS}::rewards_pool::claim_all_rewards` as `${string}::${string}::${string}`,
            typeArguments: [],
            functionArguments: []
          },
          options: { maxGasAmount: 20000 },
        });

        setCurrentHash(txResponse.hash);

        // Wait for transaction confirmation
        const maxAttempts = 10;
        const delay = 2000;
        let success = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const txStatusResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${txResponse.hash}`);
            const txData = await txStatusResponse.json();
            
            if (txData.success && txData.vm_status === 'Executed successfully') {
              success = true;
              break;
            } else if (txData.vm_status && txData.vm_status !== 'Executed successfully') {
              throw new Error(`Transaction failed: ${txData.vm_status}`);
            }
          } catch (error) {
            // Continue trying
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (success) {
          rewardsPoolRewards.forEach(reward => {
            setResults(prev => [...prev, {
              rewardKey: `${reward.farmingId}-${reward.token}`,
              success: true,
              hash: txResponse.hash
            }]);
          });
        } else {
          throw new Error('Transaction timeout');
        }
      } catch (error) {
        rewardsPoolRewards.forEach(reward => {
          setResults(prev => [...prev, {
            rewardKey: `${reward.farmingId}-${reward.token}`,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }]);
        });
      }
      
      transactionIndex++;
    }

    // Claim farming rewards separately (old mechanism)
    for (let i = 0; i < farmingRewards.length; i++) {
      const reward = farmingRewards[i];
      setCurrentIndex(transactionIndex);
      setCurrentHash("");

      try {
        // Получаем payload для claim из API
        const response = await fetch('/api/protocols/echelon/claim', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userAddress: account.address.toString(),
            rewardName: reward.rewardName || reward.token,
            farmingId: reward.farmingId
          })
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to create claim transaction");
        }

        // Отправляем транзакцию
        const txResponse = await signAndSubmitTransaction({
          data: {
            function: data.data.transactionPayload.function as `${string}::${string}::${string}`,
            typeArguments: data.data.transactionPayload.type_arguments,
            functionArguments: data.data.transactionPayload.arguments
          },
          options: { maxGasAmount: 20000 },
        });

        setCurrentHash(txResponse.hash);

        // Ждем подтверждения транзакции
        const maxAttempts = 10;
        const delay = 2000;
        let success = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const txStatusResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${txResponse.hash}`);
            const txData = await txStatusResponse.json();
            
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
            rewardKey: `${reward.farmingId}-${reward.token}`,
            success: true,
            hash: txResponse.hash
          }]);
        } else {
          throw new Error('Transaction timeout');
        }

      } catch (error) {
        setResults(prev => [...prev, {
          rewardKey: `${reward.farmingId}-${reward.token}`,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }]);
      }

      // Небольшая пауза между транзакциями
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      transactionIndex++;
    }

    setIsClaiming(false);

    // Показываем итоговый результат
    const successfulClaims = results.filter(r => r.success).length;
    const failedClaims = results.filter(r => !r.success).length;

    // Рассчитываем общую стоимость успешно заклеймленных наград
    let claimedValue = 0;
    results.forEach((result, index) => {
      if (result.success && index < claimableRewards.length) {
        const reward = claimableRewards[index];
        const tokenInfo = getRewardTokenInfoHelper(reward.token);
        if (tokenInfo) {
          const price = getTokenPrice(tokenInfo.faAddress || tokenInfo.address || '');
          const value = price && price !== '0' ? reward.amount * parseFloat(price) : 0;
          claimedValue += value;
        }
      }
    });

    if (successfulClaims > 0) {
      toast({
        title: "Claim All Rewards Completed",
        description: `Successfully claimed ${successfulClaims} rewards ($${claimedValue.toFixed(2)})${failedClaims > 0 ? `, ${failedClaims} failed` : ''}`,
      });
    }

    if (failedClaims > 0) {
      toast({
        title: "Some Claims Failed",
        description: `${failedClaims} rewards failed to claim. Check the results below.`,
        variant: "destructive"
      });
    }

    // Обновляем позиции
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('refreshPositions', { detail: { protocol: 'echelon' } }));
    }, 2000);
  };

  const handleClose = () => {
    if (!isClaiming) {
      onClose();
    }
  };

  const getCurrentRewardInfo = () => {
    // If claiming rewards_pool (transaction 0)
    if (currentIndex === 0 && rewardsPoolRewards.length > 0) {
      return {
        token: `${rewardsPoolRewards.length} rewards`,
        amount: rewardsPoolRewards.reduce((sum, r) => sum + r.amount, 0),
        farmingId: 'rewards_pool'
      };
    }
    
    // If claiming farming rewards
    const farmingIndex = rewardsPoolRewards.length > 0 ? currentIndex - 1 : currentIndex;
    if (farmingIndex >= 0 && farmingIndex < farmingRewards.length) {
      const reward = farmingRewards[farmingIndex];
      return {
        token: reward.token,
        amount: reward.amount,
        farmingId: reward.farmingId
      };
    }
    
    return null;
  };

  const currentReward = getCurrentRewardInfo();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Claim All Echelon Rewards
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Общая информация */}
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">${totalRewardsValue.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">
              Total rewards across {totalRewards} positions
            </div>
            
            {/* Детальная разбивка наград */}
            {claimableRewards.length > 0 && (
              <div className="mt-3 text-left">
                <div className="text-xs font-medium text-muted-foreground mb-2">Rewards breakdown:</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {claimableRewards.map((reward, index) => {
                    const tokenInfo = getRewardTokenInfoHelper(reward.token);
                    if (!tokenInfo) return null;
                    
                    const price = getTokenPrice(tokenInfo.faAddress || tokenInfo.address || '');
                    const value = price && price !== '0' ? (reward.amount * parseFloat(price)).toFixed(2) : 'N/A';
                    
                    return (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {tokenInfo.icon_uri && (
                            <img 
                              src={tokenInfo.icon_uri} 
                              alt={tokenInfo.symbol} 
                              className="w-3 h-3 rounded-full" 
                            />
                          )}
                          <span className="font-medium">{tokenInfo.symbol || reward.token}</span>
                          <span className="text-muted-foreground">
                            {reward.amount.toFixed(6)}
                          </span>
                        </div>
                        <span className="text-green-600 font-medium">
                          ${value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Прогресс */}
          {isClaiming && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Claiming rewards...</span>
                <span>{currentIndex + 1} / {totalTransactions}</span>
              </div>
              <Progress value={progress} className="w-full" />
              {currentReward && (
                <div className="text-xs text-muted-foreground">
                  Claiming {currentReward.amount.toFixed(6)} {currentReward.token}
                  {(() => {
                    const tokenInfo = getRewardTokenInfoHelper(currentReward.token);
                    if (!tokenInfo) return null;
                    
                    const price = getTokenPrice(tokenInfo.faAddress || tokenInfo.address || '');
                    const value = price && price !== '0' ? (currentReward.amount * parseFloat(price)).toFixed(2) : null;
                    
                    return value ? ` ($${value})` : '';
                  })()}
                </div>
              )}
              {currentHash && (
                <div className="text-xs text-muted-foreground font-mono">
                  Hash: {currentHash.slice(0, 6)}...{currentHash.slice(-4)}
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
                      {result.rewardKey.slice(0, 10)}...
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