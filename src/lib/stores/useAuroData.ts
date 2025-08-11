import { useEffect, useCallback } from 'react';
import { useAuroStore } from './auroStore';

export const useAuroData = (address?: string) => {
  const {
    // Data
    positions,
    rewards,
    pools,
    prices,
    
    // Loading states
    positionsLoading,
    rewardsLoading,
    poolsLoading,
    pricesLoading,
    
    // Error states
    positionsError,
    rewardsError,
    poolsError,
    pricesError,
    
    // Actions
    fetchPositions,
    fetchRewards,
    fetchPools,
    fetchPrices,
    
    // Getters
    getPosition,
    getPositionRewards,
    getTokenPrice,
    getPool,
    
    // Utilities
    clearData,
    isDataStale
  } = useAuroStore();

  // Auto-fetch positions when address changes
  useEffect(() => {
    if (address) {
      fetchPositions(address);
    } else {
      clearData();
    }
  }, [address, fetchPositions, clearData]);

  // Auto-fetch pools on mount
  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // Auto-fetch rewards when positions and pools are available
  useEffect(() => {
    if (address && positions.length > 0 && pools.length > 0) {
      fetchRewards(address);
    }
  }, [address, positions.length, pools.length, fetchRewards]);

  // Auto-fetch prices when positions are available
  useEffect(() => {
    if (positions.length > 0) {
      const tokenAddresses = new Set<string>();
      
      positions.forEach(position => {
        if (position.collateralTokenAddress) {
          tokenAddresses.add(position.collateralTokenAddress);
        }
        if (position.debtTokenInfo?.faAddress) {
          tokenAddresses.add(position.debtTokenInfo.faAddress);
        }
      });
      
      if (tokenAddresses.size > 0) {
        fetchPrices(Array.from(tokenAddresses));
      }
    }
  }, [positions]); // Убрали fetchPrices из зависимостей

  // Manual refresh function
  const refreshData = useCallback(async () => {
    if (!address) return;
    
    console.log('[useAuroData] Manual refresh triggered');
    
    // First fetch positions to get token addresses
    await fetchPositions(address);
    
    // Then fetch other data in parallel
    await Promise.all([
      fetchPools(),
      fetchRewards(address)
    ]);
    
    // Fetch prices after positions are loaded
    if (positions.length > 0) {
      const tokenAddresses = new Set<string>();
      
      positions.forEach(position => {
        if (position.collateralTokenAddress) {
          tokenAddresses.add(position.collateralTokenAddress);
        }
        if (position.debtTokenInfo?.faAddress) {
          tokenAddresses.add(position.debtTokenInfo.faAddress);
        }
      });
      
      if (tokenAddresses.size > 0) {
        console.log('[useAuroData] Fetching prices for tokens:', Array.from(tokenAddresses));
        await fetchPrices(Array.from(tokenAddresses), true); // Force refresh
      }
    }
  }, [address, positions]); // Убрали fetchPositions, fetchPools, fetchRewards, fetchPrices из зависимостей

  // Check if any data is loading
  const isLoading = positionsLoading || rewardsLoading || poolsLoading || pricesLoading;
  
  // Check if there are any errors
  const hasError = positionsError || rewardsError || poolsError || pricesError;

  return {
    // Data
    positions,
    rewards,
    pools,
    prices,
    
    // Loading states
    isLoading,
    positionsLoading,
    rewardsLoading,
    poolsLoading,
    pricesLoading,
    
    // Error states
    hasError,
    positionsError,
    rewardsError,
    poolsError,
    pricesError,
    
    // Actions
    refreshData,
    fetchPositions,
    fetchRewards,
    fetchPools,
    fetchPrices,
    
    // Getters
    getPosition,
    getPositionRewards,
    getTokenPrice,
    getPool,
    
    // Utilities
    clearData,
    isDataStale
  };
}; 