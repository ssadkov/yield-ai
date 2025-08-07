'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, AlertCircle, Loader2, Gift } from 'lucide-react';
import { ClaimableRewardsSummary } from '@/lib/stores/walletStore';
import { useClaimRewards } from '@/lib/hooks/useClaimRewards';
import { useWalletStore } from '@/lib/stores/walletStore';
import { ToastAction } from '@/components/ui/toast';

interface ClaimAllRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: ClaimableRewardsSummary;
  positions?: any[]; // Optional positions for Hyperion (from managing positions)
}

interface ClaimResult {
  protocol: string;
  success: boolean;
  hash?: string;
  error?: string;
}

export function ClaimAllRewardsModal({ isOpen, onClose, summary, positions }: ClaimAllRewardsModalProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();

  // Early return if summary is invalid
  if (!summary || !summary.protocols) {
    console.warn('ClaimAllRewardsModal: Invalid summary provided', summary);
    return null;
  }
  const { claimRewards, isLoading: isClaiming } = useClaimRewards();
  const { rewards } = useWalletStore();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProtocol, setCurrentProtocol] = useState<string>('');
  const [results, setResults] = useState<ClaimResult[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');

  // Get protocols with rewards
  const protocolsWithRewards = summary?.protocols ? 
    Object.entries(summary.protocols)
      .filter(([_, data]) => data.count > 0)
      .map(([protocol, data]) => ({ protocol, ...data })) :
    [];

  const totalProtocols = protocolsWithRewards.length;
  const progress = totalProtocols > 0 ? ((results.length + 1) / totalProtocols) * 100 : 0;

  const handleClaimAll = async () => {
    if (!account?.address || totalProtocols === 0) return;

    setIsProcessing(true);
    setResults([]);
    setCurrentProtocol('');

    try {
      for (const { protocol } of protocolsWithRewards) {
        setCurrentProtocol(protocol);
        
        try {
          setCurrentStep(`Preparing ${protocol} claim...`);
          
          console.log('[ClaimAll] Processing protocol:', protocol);
          
          if (protocol === 'hyperion') {
            // Special handling for Hyperion using SDK
            console.log('[ClaimAll] Using Hyperion special handling');
            await handleHyperionClaim();
          } else if (protocol === 'echelon') {
            // Special handling for Echelon - claim each reward separately
            console.log('[ClaimAll] Using Echelon special handling');
            await handleEchelonClaim();
            console.log('[ClaimAll] Echelon handling completed');
          } else {
            // Standard claim for other protocols
            console.log('[ClaimAll] Using standard claim for:', protocol);
            const { positionIds, tokenTypes } = getProtocolClaimData(protocol);
            
            console.log('[ClaimAll] Protocol data:', { positionIds, tokenTypes });
            
            if (positionIds.length === 0 || tokenTypes.length === 0) {
              console.log('[ClaimAll] No claimable data found for:', protocol);
              setResults(prev => [...prev, {
                protocol,
                success: false,
                error: 'No claimable rewards found'
              }]);
              continue;
            }

            setCurrentStep(`Claiming ${protocol} rewards...`);
            
            // Use the existing claimRewards hook
            const result = await claimRewards(protocol as any, positionIds, tokenTypes);
            
            setResults(prev => [...prev, {
              protocol,
              success: true,
              hash: result.hash
            }]);
            
            toast({
              title: `${protocol} rewards claimed!`,
              description: `Transaction: ${result.hash.slice(0, 8)}...${result.hash.slice(-8)}`,
            });
          }
          
        } catch (error) {
          console.error(`Error claiming ${protocol} rewards:`, error);
          
          setResults(prev => [...prev, {
            protocol,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }]);
          
          toast({
            title: `Failed to claim ${protocol} rewards`,
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error in claim all process:', error);
      toast({
        title: 'Claim process failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setCurrentProtocol('');
      setCurrentStep('');
    }
  };

  // Special handling for Hyperion using SDK
  const handleHyperionClaim = async () => {
    if (!signAndSubmitTransaction || !account?.address) {
      throw new Error('Wallet not connected');
    }

    // Use positions prop if available (from managing positions), otherwise fallback to store
    const hyperionPositions = positions || useWalletStore.getState().positions.hyperion || [];
    let totalClaimed = 0;

    // Filter positions with rewards (same logic as in managing positions)
    const positionsWithRewards = hyperionPositions.filter((position: any) => {
      const farmRewards = position.farm?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
      const feeRewards = position.fees?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
      return (farmRewards + feeRewards) > 0;
    });

    console.log('[ClaimAll] Hyperion positions with rewards:', positionsWithRewards.length);
    console.log('[ClaimAll] Using positions from:', positions ? 'props' : 'store');

    for (const position of positionsWithRewards) {
      if (position.position?.objectId) {
        // Check if position has unclaimed rewards
        const farmRewards = position.farm?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
        const feeRewards = position.fees?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
        const totalRewards = farmRewards + feeRewards;
        
        if (totalRewards > 0) {
          setCurrentStep(`Claiming Hyperion position ${position.position.objectId.slice(0, 8)}...`);
          
          try {
            // Import SDK dynamically to avoid SSR issues
            const { sdk } = await import('@/lib/hyperion');
            
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
              options: {
                maxGasAmount: 20000,
              },
            });

            totalClaimed++;
            
            toast({
              title: "Hyperion position claimed!",
              description: `Transaction: ${response.hash.slice(0, 8)}...${response.hash.slice(-8)}`,
              action: (
                <ToastAction altText="View in Explorer" onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${response.hash}?network=mainnet`, '_blank')}>
                  View in Explorer
                </ToastAction>
              ),
            });
            
            // Wait a bit between transactions
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            console.error('Error claiming Hyperion position:', error);
            // Don't throw error, continue with next position
            continue;
          }
        }
      }
    }

    if (totalClaimed > 0) {
      setResults(prev => [...prev, {
        protocol: 'hyperion',
        success: true,
        hash: `Claimed ${totalClaimed} positions`
      }]);
      
      // Refresh positions data after successful claim
      try {
        await useWalletStore.getState().fetchPositions(account.address.toString(), ['hyperion'], true);
      } catch (error) {
        console.error('Error refreshing positions after claim:', error);
      }
    } else {
      setResults(prev => [...prev, {
        protocol: 'hyperion',
        success: false,
        error: 'No claimable positions found'
      }]);
    }
  };

  // Get protocol-specific claim data
  const getProtocolClaimData = (protocol: string) => {
    const protocolRewards = rewards[protocol];
    
    switch (protocol) {
      case 'echelon':
        // For Echelon, we need to handle each reward separately
        // Return empty arrays as we'll handle Echelon specially in the main loop
        return { positionIds: [], tokenTypes: [] };
        
      case 'auro':
        // For Auro, we need positionIds and tokenTypes from rewards structure
        const auroRewards = protocolRewards && typeof protocolRewards === 'object' && !Array.isArray(protocolRewards) 
          ? protocolRewards as Record<string, any> 
          : {};
        const auroPositionIds: string[] = [];
        const auroTokenTypes: string[] = [];
        
        Object.entries(auroRewards).forEach(([positionId, positionRewards]: [string, any]) => {
          // Check if there are actual claimable rewards (same logic as in AuroPositions)
          const hasRewards =
            (positionRewards.collateral && positionRewards.collateral.length > 0) ||
            (positionRewards.borrow && positionRewards.borrow.length > 0);
          
          if (hasRewards) {
            auroPositionIds.push(positionId);
            
            // Add token types from both collateral and borrow rewards
            [...(positionRewards.collateral || []), ...(positionRewards.borrow || [])].forEach((reward: any) => {
              if (reward && reward.key && !auroTokenTypes.includes(reward.key)) {
                auroTokenTypes.push(reward.key);
              }
            });
          }
        });
        
        return { positionIds: auroPositionIds, tokenTypes: auroTokenTypes };
        
      default:
        return { positionIds: [], tokenTypes: [] };
    }
  };

  // Special handling for Echelon - claim each reward separately
  const handleEchelonClaim = async () => {
    if (!account?.address) {
      throw new Error('Wallet not connected');
    }

    console.log('[ClaimAll] Starting Echelon claim for address:', account.address);

    // Load Echelon rewards directly from API (same as in working EchelonPositions)
    let echelonRewards: any[] = [];
    try {
      const response = await fetch(`/api/protocols/echelon/rewards?address=${account.address}`);
      const data = await response.json();
      
      console.log('[ClaimAll] Echelon rewards API response:', data);
      
      if (data.success && Array.isArray(data.data)) {
        echelonRewards = data.data;
        console.log('[ClaimAll] Found Echelon rewards:', echelonRewards);
      } else {
        echelonRewards = [];
        console.log('[ClaimAll] No Echelon rewards found or invalid response');
      }
    } catch (error) {
      console.error('Error loading Echelon rewards:', error);
      echelonRewards = [];
    }

    let totalClaimed = 0;

    console.log('[ClaimAll] Processing', echelonRewards.length, 'Echelon rewards');

    for (const reward of echelonRewards) {
      console.log('[ClaimAll] Processing reward:', reward);
      
      // Check if reward has valid data and positive amount (same as in EchelonPositions)
      if (reward.farmingId && reward.tokenType && reward.amount && reward.amount > 0) {
        console.log('[ClaimAll] Valid reward found:', { farmingId: reward.farmingId, tokenType: reward.tokenType, amount: reward.amount });
        
        setCurrentStep(`Claiming Echelon reward ${reward.token}...`);
        
        try {
          console.log('[ClaimAll] Calling claimRewards for:', { farmingId: reward.farmingId, tokenType: reward.tokenType });
          
          // Use the same logic as in EchelonPositions - call claimRewards for each reward separately
          const result = await claimRewards('echelon', [reward.farmingId], [reward.tokenType]);
          
          console.log('[ClaimAll] Claim successful:', result);
          
          totalClaimed++;
          
          // Add individual result for each reward
          setResults(prev => [...prev, {
            protocol: 'echelon',
            success: true,
            hash: result.hash
          }]);
          
          toast({
            title: "Echelon reward claimed!",
            description: `${reward.token}: ${result.hash.slice(0, 8)}...${result.hash.slice(-8)}`,
          });
          
          // Wait a bit between transactions (same as in original)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error('Error claiming Echelon reward:', error);
          
          // Add individual error result
          setResults(prev => [...prev, {
            protocol: 'echelon',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }]);
          
          // Don't throw error, continue with next reward (same as in original)
          continue;
        }
      } else {
        console.log('[ClaimAll] Invalid reward, skipping:', { 
          hasFarmingId: !!reward.farmingId, 
          hasTokenType: !!reward.tokenType, 
          amount: reward.amount 
        });
      }
    }

    console.log('[ClaimAll] Echelon claim completed. Total claimed:', totalClaimed);

    // Update data after claiming (same as in original EchelonPositions)
    if (totalClaimed > 0 && account?.address) {
      try {
        // Refresh rewards data
        await useWalletStore.getState().fetchRewards(account.address.toString(), ['echelon'], true);
      } catch (error) {
        console.error('Error refreshing rewards after claim:', error);
      }
    }

    // Don't add a general result since we're adding individual results above
    if (totalClaimed === 0) {
      console.log('[ClaimAll] No rewards claimed, adding error result');
      setResults(prev => [...prev, {
        protocol: 'echelon',
        success: false,
        error: 'No claimable rewards found'
      }]);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
      setResults([]);
    }
  };

  const getCurrentProtocolInfo = () => {
    if (!currentProtocol || !summary?.protocols) return null;
    const protocolData = summary.protocols[currentProtocol as keyof typeof summary.protocols];
    return {
      name: currentProtocol,
      value: protocolData.value,
      count: protocolData.count
    };
  };

  const successfulClaims = results.filter(r => r.success).length;
  const failedClaims = results.filter(r => !r.success).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-600" />
            Claim All Rewards
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Available Rewards</h4>
            <div className="space-y-2">
              {protocolsWithRewards.map(({ protocol, value, count }) => (
                <div key={protocol} className="flex justify-between text-sm">
                  <span className="capitalize">{protocol}</span>
                  <span>${value.toFixed(2)} ({count} rewards)</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>${summary.totalValue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Claiming rewards...</span>
                <span>{results.length + 1}/{totalProtocols}</span>
              </div>
              <Progress value={progress} className="w-full" />
              
              {currentProtocol && (
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {currentStep}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Results</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {results.map((result, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="capitalize">{result.protocol}</span>
                    {result.success ? (
                      <span className="text-green-600">Success</span>
                    ) : (
                      <span className="text-red-600">{result.error}</span>
                    )}
                    {result.hash && result.hash.length > 20 && (
                      <span className="text-xs text-muted-foreground">
                        {result.hash.slice(0, 8)}...{result.hash.slice(-8)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              
              {!isProcessing && (
                <div className="text-sm text-muted-foreground">
                  {successfulClaims} successful, {failedClaims} failed
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            {!isProcessing && results.length === 0 && (
              <Button 
                onClick={handleClaimAll}
                disabled={isClaiming}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isClaiming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Claiming...
                  </>
                ) : (
                  'Claim All Rewards'
                )}
              </Button>
            )}
            
            {!isProcessing && (
              <Button 
                onClick={handleClose}
                variant="outline"
                className="flex-1"
              >
                {results.length > 0 ? 'Close' : 'Cancel'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 