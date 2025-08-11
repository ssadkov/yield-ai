import { useEffect, useCallback } from 'react';
import { useHyperionStore } from './hyperionStore';

export const useHyperionData = (address?: string) => {
  const {
    // Data
    positions,
    pools,
    prices,
    
    // Loading states
    positionsLoading,
    poolsLoading,
    pricesLoading,
    
    // Error states
    positionsError,
    poolsError,
    pricesError,
    
    // Actions
    fetchPositions,
    fetchPools,
    fetchPrices,
    
    // Getters
    getPosition,
    getPool,
    getTokenPrice,
    getTotalValue,
    getTotalRewards,
    
    // Utilities
    clearData,
    isDataStale
  } = useHyperionStore();

  // Auto-fetch positions when address changes
  useEffect(() => {
    if (address) {
      fetchPositions(address);
    }
  }, [address, fetchPositions]);

  // Auto-fetch pools when component mounts
  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // Auto-fetch prices when positions are available
  useEffect(() => {
    if (positions.length > 0) {
      const tokenAddresses = new Set<string>();
      
      positions.forEach(position => {
        // Add token addresses from pool
        if (position.position?.pool?.token1) {
          tokenAddresses.add(position.position.pool.token1);
        }
        if (position.position?.pool?.token2) {
          tokenAddresses.add(position.position.pool.token2);
        }
        
        // Add token addresses from rewards
        position.farm.unclaimed.forEach(reward => {
          if (reward.token) {
            tokenAddresses.add(reward.token);
          }
        });
        
        position.fees.unclaimed.forEach(fee => {
          if (fee.token) {
            tokenAddresses.add(fee.token);
          }
        });
      });
      
      if (tokenAddresses.size > 0) {
        console.log('[useHyperionData] Fetching prices for tokens:', Array.from(tokenAddresses));
        fetchPrices(Array.from(tokenAddresses), true); // Force refresh
      }
    }
  }, [positions]); // Убрали fetchPrices из зависимостей

  // Manual refresh function
  const refreshData = useCallback(async () => {
    if (!address) return;
    
    console.log('[useHyperionData] Manual refresh triggered');
    
    // First fetch positions to get token addresses
    await fetchPositions(address);
    
    // Then fetch other data in parallel
    await Promise.all([
      fetchPools()
    ]);
    
    // Fetch prices after positions are loaded
    if (positions.length > 0) {
      const tokenAddresses = new Set<string>();
      
      positions.forEach(position => {
        if (position.position?.pool?.token1) {
          tokenAddresses.add(position.position.pool.token1);
        }
        if (position.position?.pool?.token2) {
          tokenAddresses.add(position.position.pool.token2);
        }
        
        position.farm.unclaimed.forEach(reward => {
          if (reward.token) {
            tokenAddresses.add(reward.token);
          }
        });
        
        position.fees.unclaimed.forEach(fee => {
          if (fee.token) {
            tokenAddresses.add(fee.token);
          }
        });
      });
      
      if (tokenAddresses.size > 0) {
        console.log('[useHyperionData] Fetching prices for tokens:', Array.from(tokenAddresses));
        await fetchPrices(Array.from(tokenAddresses), true); // Force refresh
      }
    }
  }, [address, positions]); // Убрали fetchPositions, fetchPools, fetchPrices из зависимостей

  // Computed values
  const isLoading = positionsLoading || poolsLoading || pricesLoading;
  const hasError = positionsError || poolsError || pricesError;
  const totalValue = getTotalValue();
  const totalRewards = getTotalRewards();

  return {
    // Data
    positions,
    pools,
    prices,
    
    // Loading states
    isLoading,
    positionsLoading,
    poolsLoading,
    pricesLoading,
    
    // Error states
    hasError,
    positionsError,
    poolsError,
    pricesError,
    
    // Computed values
    totalValue,
    totalRewards,
    
    // Actions
    refreshData,
    fetchPositions,
    fetchPools,
    fetchPrices,
    
    // Getters
    getPosition,
    getPool,
    getTokenPrice,
    
    // Utilities
    clearData,
    isDataStale
  };
}; 