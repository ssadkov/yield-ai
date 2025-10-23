import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { normalizeAddress, findTokenByAddress } from '@/lib/utils/addressNormalization';

// Types for Hyperion data
export interface HyperionPosition {
  isActive: boolean;
  value: string;
  farm: {
    claimed: any[];
    unclaimed: Array<{
      amount: string;
      amountUSD: string;
      token: string;
    }>;
  };
  fees: {
    claimed: any[];
    unclaimed: Array<{
      amount: string;
      amountUSD: string;
      token: string;
    }>;
  };
  position: {
    objectId: string;
    poolId: string;
    tickLower: number;
    tickUpper: number;
    createdAt: string;
    pool: {
      currentTick: number;
      feeRate: string;
      feeTier: number;
      poolId: string;
      token1: string;
      token2: string;
      token1Info: {
        logoUrl: string;
        symbol: string;
      };
      token2Info: {
        logoUrl: string;
        symbol: string;
      };
    };
  };
}

export interface HyperionPool {
  poolId: string;
  feeAPR: string;
  farmAPR: string;
  tvlUSD: string;
  dailyVolumeUSD: string;
  feesUSD: string;
  token1: string;
  token2: string;
  token1Info: {
    logoUrl: string;
    symbol: string;
  };
  token2Info: {
    logoUrl: string;
    symbol: string;
  };
}

// Cache TTL constants
const CACHE_TTL = {
  POSITIONS: 30 * 1000, // 30 seconds
  POOLS: 60 * 1000,     // 1 minute
  PRICES: 30 * 1000,    // 30 seconds
} as const;

// Store state interface
interface HyperionState {
  // Data
  positions: HyperionPosition[];
  pools: HyperionPool[];
  prices: Record<string, string>;
  
  // Loading states
  positionsLoading: boolean;
  poolsLoading: boolean;
  pricesLoading: boolean;
  
  // Error states
  positionsError: string | null;
  poolsError: string | null;
  pricesError: string | null;
  
  // Timestamps
  lastPositionsUpdate: number | null;
  lastPoolsUpdate: number | null;
  lastPricesUpdate: number | null;
  
  // Actions
  fetchPositions: (address: string) => Promise<void>;
  fetchPools: () => Promise<void>;
  fetchPrices: (tokenAddresses: string[], forceRefresh?: boolean) => Promise<void>;
  
  // Getters
  getPosition: (positionId: string) => HyperionPosition | undefined;
  getPool: (poolId: string) => HyperionPool | undefined;
  getTokenPrice: (tokenAddress: string) => string;
  getTotalValue: () => number;
  getTotalRewards: () => number;
  
  // Utilities
  clearData: () => void;
  isDataStale: (type: 'positions' | 'pools' | 'prices') => boolean;
}

// Create store
export const useHyperionStore = create<HyperionState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        positions: [],
        pools: [],
        prices: {},
        
        positionsLoading: false,
        poolsLoading: false,
        pricesLoading: false,
        
        positionsError: null,
        poolsError: null,
        pricesError: null,
        
        lastPositionsUpdate: null,
        lastPoolsUpdate: null,
        lastPricesUpdate: null,
        
        // Actions
        fetchPositions: async (address: string) => {
          const state = get();
          
          // Check if data is fresh
          if (state.lastPositionsUpdate && 
              Date.now() - state.lastPositionsUpdate < CACHE_TTL.POSITIONS) {
            console.log('[HyperionStore] Using cached positions data');
            return;
          }
          
          set({ positionsLoading: true, positionsError: null });
          
          try {
            console.log('[HyperionStore] Fetching positions for address:', address);
            
            const response = await fetch(`/api/protocols/hyperion/userPositions?address=${address}`);
            
            if (!response.ok) {
              throw new Error(`API returned status ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && Array.isArray(data.data)) {
              // Remove duplicates by positionId
              const seenIds = new Set<string>();
              const uniquePositions = data.data.filter((position: HyperionPosition) => {
                const positionId = position.position?.objectId;
                if (!positionId || seenIds.has(positionId)) {
                  return false;
                }
                seenIds.add(positionId);
                return true;
              });
              
              // Sort by value
              const sortedPositions = [...uniquePositions].sort((a, b) => {
                const valueA = parseFloat(a.value || "0");
                const valueB = parseFloat(b.value || "0");
                return valueB - valueA;
              });
              
              set({
                positions: sortedPositions,
                positionsLoading: false,
                lastPositionsUpdate: Date.now(),
                positionsError: null
              });
              
              console.log('[HyperionStore] Positions fetched successfully:', sortedPositions.length);
            } else {
              set({
                positions: [],
                positionsLoading: false,
                lastPositionsUpdate: Date.now(),
                positionsError: null
              });
              console.log('[HyperionStore] No positions found');
            }
          } catch (error) {
            console.error('[HyperionStore] Error fetching positions:', error);
            set({
              positions: [],
              positionsLoading: false,
              positionsError: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        },
        
        fetchPools: async () => {
          const state = get();
          
          // Check if data is fresh
          if (state.lastPoolsUpdate && 
              Date.now() - state.lastPoolsUpdate < CACHE_TTL.POOLS) {
            console.log('[HyperionStore] Using cached pools data');
            return;
          }
          
          set({ poolsLoading: true, poolsError: null });
          
          try {
            console.log('[HyperionStore] Fetching pools data');
            
            const response = await fetch('/api/protocols/hyperion/pools');
            
            if (!response.ok) {
              throw new Error(`API returned status ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && Array.isArray(data.data)) {
              set({
                pools: data.data,
                poolsLoading: false,
                lastPoolsUpdate: Date.now(),
                poolsError: null
              });
              console.log('[HyperionStore] Pools fetched successfully:', data.data.length);
            } else {
              set({
                pools: [],
                poolsLoading: false,
                lastPoolsUpdate: Date.now(),
                poolsError: null
              });
              console.log('[HyperionStore] No pools found');
            }
          } catch (error) {
            console.error('[HyperionStore] Error fetching pools:', error);
            set({
              pools: [],
              poolsLoading: false,
              poolsError: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        },
        
        fetchPrices: async (tokenAddresses: string[], forceRefresh = false) => {
          const state = get();
          
          // Check if data is fresh (unless force refresh)
          if (!forceRefresh && state.lastPricesUpdate && 
              Date.now() - state.lastPricesUpdate < CACHE_TTL.PRICES) {
            console.log('[HyperionStore] Using cached prices data');
            return;
          }
          
          set({ pricesLoading: true, pricesError: null });
          
          try {
            console.log('[HyperionStore] Fetching prices for tokens:', tokenAddresses.length);
            
            // Use Panora API to fetch prices with safe import
            const { safeImport } = await import('@/lib/utils/safeImport');
            const { PanoraPricesService } = await safeImport(() => import('@/lib/services/panora/prices'));
            const pricesService = PanoraPricesService.getInstance();
            
            const prices: Record<string, string> = {};
            
            for (const address of tokenAddresses) {
              let cleanAddress = address;
              
              // Handle Aptos token addresses
              if (address.includes('::')) {
                // Extract the last part after ::
                const parts = address.split('::');
                cleanAddress = parts[parts.length - 1];
              }
              
              try {
                const priceData = await pricesService.getPrices(1, [cleanAddress]);
                
                if (priceData && priceData.data && Array.isArray(priceData.data)) {
                  // Use utility function to find token by address (handles normalization)
                  const token = findTokenByAddress(priceData.data, cleanAddress);
                  
                  if (token && token.usdPrice) {
                    // Save price under original address
                    prices[address] = token.usdPrice;
                    // Also save under normalized version
                    const normalizedAddress = normalizeAddress(address);
                    if (normalizedAddress !== address) {
                      prices[normalizedAddress] = token.usdPrice;
                    }
                    console.log('[HyperionStore] Added price for', address, ':', token.usdPrice);
                  }
                }
              } catch (error) {
                console.warn('[HyperionStore] Failed to fetch price for', address, error);
              }
            }
            
            console.log('[HyperionStore] Final prices object:', prices);
            console.log('[HyperionStore] Current state prices before update:', state.prices);
            
            const newPrices = { ...state.prices, ...prices };
            console.log('[HyperionStore] New prices object after merge:', newPrices);
            
            set({
              prices: newPrices,
              pricesLoading: false,
              lastPricesUpdate: Date.now(),
              pricesError: null
            });
            
            // Verify the update
            const updatedState = get();
            console.log('[HyperionStore] State prices after update:', updatedState.prices);
            console.log('[HyperionStore] Prices fetched and saved successfully');
          } catch (error) {
            console.error('[HyperionStore] Error fetching prices:', error);
            set({
              pricesLoading: false,
              pricesError: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        },
        
        // Getters
        getPosition: (positionId: string) => {
          const state = get();
          return state.positions.find(pos => pos.position.objectId === positionId);
        },
        
        getPool: (poolId: string) => {
          const state = get();
          return state.pools.find(pool => pool.poolId === poolId);
        },
        
        getTokenPrice: (tokenAddress: string) => {
          const state = get();
          return state.prices[tokenAddress] || '0';
        },
        
        getTotalValue: () => {
          const state = get();
          return state.positions.reduce((sum, pos) => {
            return sum + parseFloat(pos.value || '0');
          }, 0);
        },
        
        getTotalRewards: () => {
          const state = get();
          return state.positions.reduce((sum, pos) => {
            const farmRewards = pos.farm.unclaimed.reduce((fSum, reward) => {
              return fSum + parseFloat(reward.amountUSD || '0');
            }, 0);
            
            const feeRewards = pos.fees.unclaimed.reduce((fSum, fee) => {
              return fSum + parseFloat(fee.amountUSD || '0');
            }, 0);
            
            return sum + farmRewards + feeRewards;
          }, 0);
        },
        
        // Utilities
        clearData: () => {
          set({
            positions: [],
            pools: [],
            prices: {},
            lastPositionsUpdate: null,
            lastPoolsUpdate: null,
            lastPricesUpdate: null,
            positionsError: null,
            poolsError: null,
            pricesError: null
          });
        },
        
        isDataStale: (type: 'positions' | 'pools' | 'prices') => {
          const state = get();
          const lastUpdate = state[`last${type.charAt(0).toUpperCase() + type.slice(1)}Update` as keyof HyperionState] as number | null;
          const ttl = CACHE_TTL[type.toUpperCase() as keyof typeof CACHE_TTL];
          
          return !lastUpdate || Date.now() - lastUpdate > ttl;
        }
      }),
      {
        name: 'hyperion-storage',
        partialize: (state) => ({
          positions: state.positions,
          pools: state.pools,
          prices: state.prices,
          lastPositionsUpdate: state.lastPositionsUpdate,
          lastPoolsUpdate: state.lastPoolsUpdate,
          lastPricesUpdate: state.lastPricesUpdate
        })
      }
    )
  )
); 