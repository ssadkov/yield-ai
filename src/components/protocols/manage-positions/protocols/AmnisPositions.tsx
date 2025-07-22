'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AmnisPositionsList } from '../../amnis/PositionsList';
import { useWallet } from "@aptos-labs/wallet-adapter-react";

interface AmnisPosition {
  id: string;
  poolId: string;
  poolName: string;
  token: string;
  tokenSymbol?: string;
  stakedAmount: string;
  stakingTokenAmount?: string;
  value?: number;
  usdValue?: number;
  apy: number;
  rewards?: number;
  type?: string;
  assetInfo?: any;
  isActive: boolean;
  lockDuration?: string;
  pools?: any[];
}

export const AmnisPositions: React.FC = () => {
  const { account } = useWallet();
  const [positions, setPositions] = useState<AmnisPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);

  // Function to load positions
  const loadPositions = useCallback(async () => {
    if (!account?.address) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/protocols/amnis/userPositions?address=${account.address}`);
      const data = await response.json();
      
      if (data.success && Array.isArray(data.positions)) {
        setPositions(data.positions);
        // Calculate total value using usdValue if available, otherwise fallback to value
        const total = data.positions.reduce((sum: number, pos: AmnisPosition) => {
          const positionValue = pos.usdValue || pos.value || 0;
          const rewardsValue = pos.rewards || 0;
          return sum + positionValue + rewardsValue;
        }, 0);
        setTotalValue(total);
      } else {
        setPositions([]);
        setTotalValue(0);
      }
    } catch (error) {
      console.error('Error loading Amnis positions:', error);
      setError('Failed to load positions');
      setPositions([]);
      setTotalValue(0);
    } finally {
      setLoading(false);
    }
  }, [account?.address]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const handleWithdraw = (position: AmnisPosition) => {
    // TODO: Implement withdraw functionality
    console.log('Withdraw from Amnis position:', position);
  };

  const handleClaim = (position: AmnisPosition) => {
    // TODO: Implement claim functionality
    console.log('Claim rewards from Amnis position:', position);
  };

  const handleStake = () => {
    // TODO: Implement stake functionality
    console.log('Stake to Amnis');
  };

  if (loading) {
    return <div>Loading Amnis positions...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <AmnisPositionsList
      positions={positions}
      totalValue={totalValue}
      onWithdraw={handleWithdraw}
      onClaim={handleClaim}
      onStake={handleStake}
    />
  );
}; 