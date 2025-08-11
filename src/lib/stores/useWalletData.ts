import { useEffect, useCallback, useMemo } from 'react';
import { useWalletStore } from './walletStore';

export const useWalletData = (address?: string) => {
  const {
    // Data
    balance,
    positions,
    rewards,
    prices,
    
    // Loading states
    balanceLoading,
    positionsLoading,
    rewardsLoading,
    pricesLoading,
    
    // Error states
    balanceError,
    positionsError,
    rewardsError,
    pricesError,
    
    // Actions
    setAddress,
    fetchBalance,
    fetchPositions,
    fetchRewards,
    fetchPrices,
    
    // Getters
    getBalance,
    getPositions,
    getRewards,
    getTokenPrice,
    getTotalValue,
    
    // Utilities
    clearData,
    isDataStale
  } = useWalletStore();

  // Set address when it changes
  useEffect(() => {
    setAddress(address || null);
  }, [address]); // Убрали setAddress из зависимостей

  // Auto-fetch balance when address changes
  useEffect(() => {
    if (address) {
      fetchBalance(address);
    }
  }, [address]); // Убрали fetchBalance из зависимостей

  // Auto-fetch positions when address changes
  useEffect(() => {
    if (address) {
      fetchPositions(address);
    }
  }, [address]); // Убрали fetchPositions из зависимостей

  // Auto-fetch rewards when address changes
  useEffect(() => {
    if (address) {
      fetchRewards(address);
    }
  }, [address]); // Убрали fetchRewards из зависимостей

  // Auto-fetch prices when positions are available
  useEffect(() => {
    if (Object.keys(positions).length > 0) {
      const tokenAddresses = new Set<string>();
      
      // Collect all token addresses from positions
      Object.values(positions).forEach(protocolPositions => {
        protocolPositions.forEach((position: any) => {
          // Add token addresses based on position structure
          if (position.coin) {
            tokenAddresses.add(position.coin);
          }
          if (position.token) {
            tokenAddresses.add(position.token);
          }
          if (position.collateralTokenAddress) {
            tokenAddresses.add(position.collateralTokenAddress);
          }
          if (position.debtTokenInfo?.faAddress) {
            tokenAddresses.add(position.debtTokenInfo.faAddress);
          }
          // Add more token address fields as needed
        });
      });
      
      if (tokenAddresses.size > 0) {
        fetchPrices(Array.from(tokenAddresses));
      }
    }
  }, [positions]); // Убрали fetchPrices из зависимостей

  // Computed values
  const isLoading = useMemo(() => {
    return balanceLoading || positionsLoading || rewardsLoading || pricesLoading;
  }, [balanceLoading, positionsLoading, rewardsLoading, pricesLoading]);

  const hasError = useMemo(() => {
    return balanceError || positionsError || rewardsError || pricesError;
  }, [balanceError, positionsError, rewardsError, pricesError]);

  const totalValue = useMemo(() => {
    return getTotalValue();
  }, []); // Убрали getTotalValue из зависимостей

  // Refresh functions
  const refreshBalance = useCallback(() => {
    if (address) {
      fetchBalance(address, true);
    }
  }, [address]); // Убрали fetchBalance из зависимостей

  const refreshPositions = useCallback(() => {
    if (address) {
      fetchPositions(address, undefined, true);
    }
  }, [address]); // Убрали fetchPositions из зависимостей

  const refreshRewards = useCallback(() => {
    if (address) {
      fetchRewards(address, undefined, true);
    }
  }, [address]); // Убрали fetchRewards из зависимостей

  const refreshPrices = useCallback((tokenAddresses?: string[]) => {
    if (tokenAddresses) {
      fetchPrices(tokenAddresses, true);
    } else {
      // Get all token addresses from current positions
      const allTokenAddresses = new Set<string>();
      Object.values(positions).forEach(protocolPositions => {
        protocolPositions.forEach((position: any) => {
          if (position.coin) allTokenAddresses.add(position.coin);
          if (position.token) allTokenAddresses.add(position.token);
          if (position.collateralTokenAddress) allTokenAddresses.add(position.collateralTokenAddress);
          if (position.debtTokenInfo?.faAddress) allTokenAddresses.add(position.debtTokenInfo.faAddress);
        });
      });
      if (allTokenAddresses.size > 0) {
        fetchPrices(Array.from(allTokenAddresses), true);
      }
    }
  }, [positions]); // Убрали fetchPrices из зависимостей

  const refreshAll = useCallback(() => {
    if (address) {
      fetchBalance(address, true);
      fetchPositions(address, undefined, true);
      fetchRewards(address, undefined, true);
      refreshPrices();
    }
  }, [address, fetchBalance, fetchPositions, fetchRewards]); // Убрали refreshPrices из зависимостей

  return {
    // Data
    balance,
    positions,
    rewards,
    prices,
    
    // Loading states
    isLoading,
    balanceLoading,
    positionsLoading,
    rewardsLoading,
    pricesLoading,
    
    // Error states
    hasError,
    balanceError,
    positionsError,
    rewardsError,
    pricesError,
    
    // Computed values
    totalValue,
    
    // Actions
    refreshAll,
    refreshBalance,
    refreshPositions,
    refreshRewards,
    refreshPrices,
    fetchBalance,
    fetchPositions,
    fetchRewards,
    fetchPrices,
    
    // Getters
    getBalance,
    getPositions,
    getRewards,
    getTokenPrice,
    getTotalValue,
    
    // Utilities
    clearData,
    isDataStale
  };
}; 