'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, AlertCircle, Loader2, Gift } from 'lucide-react';
import { isUserRejectedError } from '@/lib/utils/errors';
import { ClaimableRewardsSummary } from '@/lib/stores/walletStore';
import { useClaimRewards } from '@/lib/hooks/useClaimRewards';
import { useWalletStore } from '@/lib/stores/walletStore';
import { ToastAction } from '@/components/ui/toast';
import { getBaseUrl } from '@/lib/utils/config';

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
  positionId?: string; // For Hyperion positions
  value?: number; // Value of claimed rewards
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
  const [claimedValue, setClaimedValue] = useState(0);

  // Helper: detect user rejected errors from different wallets
  const isUserRejected = isUserRejectedError;

  // Get protocols with rewards
  const protocolsWithRewards = summary?.protocols ? 
    Object.entries(summary.protocols)
      .filter(([_, data]) => data.count > 0)
      .map(([protocol, data]) => ({ protocol, ...data })) :
    [];

  // Calculate total positions/rewards for progress (not protocols)
  const getTotalPositions = () => {
    let total = 0;
    protocolsWithRewards.forEach(({ protocol, count }) => {
      if (protocol === 'hyperion') {
        // For Hyperion, use actual positions count
        const hyperionPositions = positions || useWalletStore.getState().positions.hyperion || [];
        const positionsWithRewards = hyperionPositions.filter((position: any) => {
          const farmRewards = position.farm?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
          const feeRewards = position.fees?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
          return (farmRewards + feeRewards) > 0;
        });
        total += positionsWithRewards.length;
      } else {
        // For other protocols, use count from summary
        total += count;
      }
    });
    return total;
  };

  const totalPositions = getTotalPositions();
  const progress = totalPositions > 0 ? ((results.length + 1) / totalPositions) * 100 : 0;

  const handleClaimAll = async () => {
    if (!account?.address || totalPositions === 0) return;

    setIsProcessing(true);
    setResults([]);
    setCurrentProtocol('');
    setClaimedValue(0);

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
          } else if (protocol === 'meso') {
            // Special handling for Meso - single tx claim_all_apt_rewards
            console.log('[ClaimAll] Using Meso special handling');
            await handleMesoClaim();
          } else if (protocol === 'earnium') {
            // Special handling for Earnium - single tx claim_all_rewards
            console.log('[ClaimAll] Using Earnium special handling');
            await handleEarniumClaim();
          } else if (protocol === 'moar') {
            // Special handling for Moar - group by farming_identifier
            console.log('[ClaimAll] Using Moar special handling');
            await handleMoarClaim();
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
            
            // Update claimed value (estimate based on protocol value)
            const protocolData = summary.protocols[protocol as keyof typeof summary.protocols];
            if (protocolData) {
              setClaimedValue(prev => prev + protocolData.value);
            }
            
            toast({
              title: `${protocol} rewards claimed!`,
              description: `Transaction: ${result.hash.slice(0, 8)}...${result.hash.slice(-8)}`,
            });
          }
          
        } catch (error) {
          console.error(`Error claiming ${protocol} rewards:`, error);
          const msg = isUserRejected(error) ? 'User rejected' : (error instanceof Error ? error.message : 'Unknown error');
          setResults(prev => [...prev, {
            protocol,
            success: false,
            error: msg
          }]);
          toast({
            title: isUserRejected(error) ? `Claim cancelled` : `Failed to claim ${protocol} rewards` ,
            description: msg,
            variant: isUserRejected(error) ? 'default' : 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error in claim all process:', error);
      const msg = isUserRejected(error) ? 'User rejected' : (error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: isUserRejected(error) ? 'Claim cancelled' : 'Claim process failed',
        description: msg,
        variant: isUserRejected(error) ? 'default' : 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setCurrentProtocol('');
      setCurrentStep('');
    }
  };

  // Special handling for Meso - single call claim_all_apt_rewards
  const handleMesoClaim = async () => {
    if (!signAndSubmitTransaction || !account?.address) {
      throw new Error('Wallet not connected');
    }

    const functionAddress = '0x68476f9d437e3f32fd262ba898b5e3ee0a23a1d586a6cf29a28add35f253f6f7';
    const tokens = [
      "0x1::aptos_coin::AptosCoin",
      "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
      "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt",
      "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
      "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt",
      "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WBTC",
      "0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6::staking::StakedThalaAPT",
      "0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451",
      "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT",
      "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
      "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH",
      "0x68844a0d7f2587e726ad0579f3d640865bb4162c08a4589eeda3f9689ec52a3d",
      "0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T",
      "0x2ebb2ccac5e027a87fa0e2e5f656a3a4238d6a48d93ec9b610d570fc0aa0df12",
      "0xada35ada7e43e2ee1c39633ffccec38b76ce702b4efc2e60b50f63fbe4f710d8::apetos_token::ApetosCoin",
      "0x159df6b7689437016108a019fd5bef736bac692b6d4a1f10c941f6fbb9a74ca6::oft::CakeOFT",
      "0x63be1898a424616367e19bbd881f456a78470e123e2770b5b5dcdceb61279c54::movegpt_token::MovegptCoin",
      "0xaef6a8c3182e076db72d64324617114cacf9a52f28325edc10b483f7f05da0e7"
    ];

    setCurrentStep('Claiming Meso rewards...');
    const payload = {
      data: {
        function: `${functionAddress}::meso::claim_all_apt_rewards` as `${string}::${string}::${string}`,
        typeArguments: [] as string[],
        functionArguments: [tokens] as any[]
      }
    } as const;

    const tx = await signAndSubmitTransaction(payload as any);

    setResults(prev => [...prev, { protocol: 'meso', success: true, hash: tx.hash }]);
    const mesoValue = summary.protocols.meso?.value || 0;
    setClaimedValue(prev => prev + mesoValue);

    toast({
      title: `meso rewards claimed!`,
      description: `Transaction: ${tx.hash.slice(0, 8)}...${tx.hash.slice(-8)}`,
      action: (
        <ToastAction altText="View in Explorer" onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet`, '_blank')}>
          View in Explorer
        </ToastAction>
      ),
    });
  };

  // Special handling for Moar - group by farming_identifier
  const handleMoarClaim = async () => {
    if (!account?.address) {
      throw new Error('Wallet not connected');
    }

    console.log('[ClaimAll] Starting Moar claim for address:', account.address);

    // Load Moar rewards to get farming_identifier and reward_id data
    let moarRewards: any[] = [];
    try {
      const response = await fetch(`${getBaseUrl()}/api/protocols/moar/rewards?address=${account.address}`);
      const data = await response.json();
      
      console.log('[ClaimAll] Moar rewards API response:', data);
      
      if (data.success && Array.isArray(data.data)) {
        moarRewards = data.data;
        console.log('[ClaimAll] Found Moar rewards:', moarRewards);
      } else {
        moarRewards = [];
        console.log('[ClaimAll] No Moar rewards found or invalid response');
      }
    } catch (error) {
      console.error('[ClaimAll] Error fetching Moar rewards:', error);
      moarRewards = [];
    }

    if (moarRewards.length === 0) {
      console.log('[ClaimAll] No Moar rewards to claim');
      setResults(prev => [...prev, {
        protocol: 'moar',
        success: false,
        error: 'No rewards found'
      }]);
      return;
    }

    // Group rewards by farming_identifier to avoid duplicate calls
    const rewardsByPool = new Map();
    moarRewards.forEach((reward: any) => {
      if (reward.farming_identifier && reward.reward_id) {
        if (!rewardsByPool.has(reward.farming_identifier)) {
          rewardsByPool.set(reward.farming_identifier, []);
        }
        rewardsByPool.get(reward.farming_identifier).push(reward.reward_id);
      }
    });

    console.log('[ClaimAll] Grouped Moar rewards by pool:', Array.from(rewardsByPool.entries()));

    let totalClaimedRewards = 0;
    let lastTransactionHash = '';

    // Claim rewards for each pool
    for (const [farmingIdentifier, rewardIds] of rewardsByPool) {
      console.log(`[ClaimAll] Claiming Moar rewards for pool ${farmingIdentifier}:`, rewardIds);
      
      setCurrentStep(`Claiming Moar pool`);
      
      try {
        const result = await claimRewards('moar', [farmingIdentifier], rewardIds);
        
        // Extract transaction hash if available
        if (result && result.hash) {
          lastTransactionHash = result.hash;
        }
        
        totalClaimedRewards += rewardIds.length;
        
        // Small delay between claims to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[ClaimAll] Error claiming Moar pool ${farmingIdentifier}:`, error);
        throw error;
      }
    }

    setResults(prev => [...prev, {
      protocol: 'moar',
      success: true,
      hash: lastTransactionHash
    }]);

    const moarValue = summary.protocols.moar?.value || 0;
    setClaimedValue(prev => prev + moarValue);

    toast({
      title: `Moar rewards claimed!`,
      description: `Successfully claimed ${totalClaimedRewards} rewards from ${rewardsByPool.size} pools`,
      action: lastTransactionHash ? (
        <ToastAction altText="View in Explorer" onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${lastTransactionHash}?network=mainnet`, '_blank')}>
          View in Explorer
        </ToastAction>
      ) : undefined,
    });
  };

  // Special handling for Earnium - single call claim_all_rewards
  const handleEarniumClaim = async () => {
    if (!signAndSubmitTransaction || !account?.address) {
      throw new Error('Wallet not connected');
    }

    console.log('[ClaimAll] Starting Earnium claim for address:', account.address);

    // Load Earnium rewards to get pool indices
    let earniumRewards: any[] = [];
    try {
      const response = await fetch(`${getBaseUrl()}/api/protocols/earnium/rewards?address=${account.address}`);
      const data = await response.json();
      
      console.log('[ClaimAll] Earnium rewards API response:', data);
      
      if (data.success && Array.isArray(data.data)) {
        earniumRewards = data.data;
        console.log('[ClaimAll] Found Earnium rewards:', earniumRewards);
      } else {
        earniumRewards = [];
        console.log('[ClaimAll] No Earnium rewards found or invalid response');
      }
    } catch (error) {
      console.error('Error loading Earnium rewards:', error);
      earniumRewards = [];
    }

    if (earniumRewards.length === 0) {
      setResults(prev => [...prev, {
        protocol: 'earnium',
        success: false,
        error: 'No claimable rewards found'
      }]);
      return;
    }

    // Get pool indices that have rewards
    const poolIndices = earniumRewards
      .filter((pool: any) => 
        Array.isArray(pool.rewards) && 
        pool.rewards.some((r: any) => Number(r.amountRaw || 0) > 0)
      )
      .map((pool: any) => pool.pool);

    if (poolIndices.length === 0) {
      setResults(prev => [...prev, {
        protocol: 'earnium',
        success: false,
        error: 'No pools with claimable rewards found'
      }]);
      return;
    }

    console.log('[ClaimAll] Claiming rewards for pools:', poolIndices);

    setCurrentStep('Claiming Earnium rewards...');

    try {
      // Use the EarniumProtocol to build the claim payload with safe import
      const { safeImport } = await import('@/lib/utils/safeImport');
      const { EarniumProtocol } = await safeImport(() => import('@/lib/protocols/earnium'));
      const earniumProtocol = new EarniumProtocol();
      
      const payload = await earniumProtocol.buildClaimRewards(
        poolIndices.map(String), // Convert to string array
        [], // tokenTypes not used for Earnium
        account.address.toString()
      );

      const tx = await signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.type_arguments,
          functionArguments: payload.arguments
        },
        options: { maxGasAmount: 20000 },
      });

      setResults(prev => [...prev, { 
        protocol: 'earnium', 
        success: true, 
        hash: tx.hash 
      }]);

      // Update claimed value
      const earniumValue = summary.protocols.earnium?.value || 0;
      setClaimedValue(prev => prev + earniumValue);

      toast({
        title: `Earnium rewards claimed!`,
        description: `Transaction: ${tx.hash.slice(0, 8)}...${tx.hash.slice(-8)}`,
        action: (
          <ToastAction altText="View in Explorer" onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${tx.hash}?network=mainnet`, '_blank')}>
            View in Explorer
          </ToastAction>
        ),
      });

      // Refresh rewards data after successful claim
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshPositions', { detail: { protocol: 'earnium' } }));
      }, 2000);

    } catch (error) {
      console.error('Error claiming Earnium rewards:', error);
      const msg = isUserRejected(error) ? 'User rejected' : (error instanceof Error ? error.message : 'Unknown error');
      setResults(prev => [...prev, {
        protocol: 'earnium',
        success: false,
        error: msg
      }]);
      toast({
        title: isUserRejected(error) ? 'Claim cancelled' : 'Failed to claim Earnium rewards',
        description: msg,
        variant: isUserRejected(error) ? 'default' : 'destructive',
      });
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

    if (positionsWithRewards.length === 0) {
      setResults(prev => [...prev, {
        protocol: 'hyperion',
        success: false,
        error: 'No claimable positions found'
      }]);
      return;
    }

    for (const position of positionsWithRewards) {
      if (position.position?.objectId) {
        // Check if position has unclaimed rewards
        const farmRewards = position.farm?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
        const feeRewards = position.fees?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
        const totalRewards = farmRewards + feeRewards;
        
        if (totalRewards > 0) {
          setCurrentStep(`Claiming Hyperion position ${position.position.objectId.slice(0, 8)}...`);
          
          try {
            // Import SDK dynamically to avoid SSR issues with safe import
            const { safeImport } = await import('@/lib/utils/safeImport');
            const { sdk } = await safeImport(() => import('@/lib/hyperion'));
            
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
            
            // Add individual result for this position
            setResults(prev => [...prev, {
              protocol: 'hyperion',
              success: true,
              hash: response.hash,
              positionId: position.position.objectId.slice(0, 8),
              value: totalRewards
            }]);
            
            // Update claimed value
            setClaimedValue(prev => prev + totalRewards);
            
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
            const msg = isUserRejected(error) ? 'User rejected' : (error instanceof Error ? error.message : 'Unknown error');
            // Add individual error result for this position
            setResults(prev => [...prev, {
              protocol: 'hyperion',
              success: false,
              error: msg,
              positionId: position.position.objectId.slice(0, 8),
              value: totalRewards
            }]);
            // Don't throw error, continue with next position
            continue;
          }
        }
      }
    }

    // Note: Individual results are already added in the loop above
    // Just refresh positions data after successful claim
    if (totalClaimed > 0) {
      try {
        await useWalletStore.getState().fetchPositions(account.address.toString(), ['hyperion'], true);
      } catch (error) {
        console.error('Error refreshing positions after claim:', error);
      }
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
        
      case 'earnium':
        // For Earnium, we need pool indices that have rewards
        const earniumRewards = protocolRewards && Array.isArray(protocolRewards) ? protocolRewards : [];
        const earniumPoolIndices: string[] = [];
        
        earniumRewards.forEach((pool: any) => {
          if (Array.isArray(pool.rewards) && pool.rewards.some((r: any) => Number(r.amountRaw || 0) > 0)) {
            earniumPoolIndices.push(pool.pool.toString());
          }
        });
        
        return { positionIds: earniumPoolIndices, tokenTypes: [] };
        
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
      const response = await fetch(`${getBaseUrl()}/api/protocols/echelon/rewards?address=${account.address}`);
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
          
          // Update claimed value (estimate based on reward amount)
          const rewardValue = reward.amountUSD ? parseFloat(reward.amountUSD) : 0;
          setClaimedValue(prev => prev + rewardValue);
          
          toast({
            title: "Echelon reward claimed!",
            description: `${reward.token}: ${result.hash.slice(0, 8)}...${result.hash.slice(-8)}`,
          });
          
          // Wait a bit between transactions (same as in original)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error('Error claiming Echelon reward:', error);
          const msg = isUserRejected(error) ? 'User rejected' : (error instanceof Error ? error.message : 'Unknown error');
          // Add individual error result
          setResults(prev => [...prev, {
            protocol: 'echelon',
            success: false,
            error: msg
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
    // if (totalClaimed === 0) {
    //   console.log('[ClaimAll] No rewards claimed, adding error result');
    //   setResults(prev => [...prev, {
    //     protocol: 'echelon',
    //     success: false,
    //     error: 'No claimable rewards found'
    //   }]);
    // }
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
            <Gift className="h-5 w-5 text-success" />
            Claim All Rewards
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-muted p-4 rounded-lg">
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
                <span>{results.length + 1}/{totalPositions}</span>
              </div>
              <Progress value={progress} className="w-full" />
              
              {claimedValue > 0 && (
                <div className="text-sm text-success font-medium">
                  Claimed so far: ${claimedValue.toFixed(2)}
                </div>
              )}
              
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
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-error" />
                    )}
                    <span className="capitalize">{result.protocol}</span>
                    {result.positionId && (
                      <span className="text-muted-foreground">({result.positionId}...)</span>
                    )}
                    {result.success ? (
                      <div className="flex items-center gap-1">
                        <span className="text-success">Success</span>
                        {result.value && (
                          <span className="text-success">(${result.value.toFixed(2)})</span>
                        )}
                        {result.hash && result.hash.length > 20 && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {result.hash.slice(0, 8)}...{result.hash.slice(-8)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-error">{result.error}</span>
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
                className="flex-1 bg-success text-success-foreground hover:bg-success/90"
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