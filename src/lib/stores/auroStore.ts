import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { createDualAddressPriceMap } from '@/lib/utils/addressNormalization';

// Types for Auro data
export interface AuroPosition {
  address: string;
  poolAddress: string;
  collateralTokenAddress?: string;
  collateralTokenInfo?: any;
  debtTokenInfo?: any;
  collateralAmount: string;
  debtAmount: string;
  liquidatePrice: string;
  collateralSymbol: string;
  debtSymbol: string;
}

export interface AuroReward {
  key: string;
  value: string;
  tokenInfo?: {
    address: string;
    faAddress: string;
    symbol: string;
    icon_uri: string;
    decimals: number;
    price: string;
  };
}

export interface AuroRewardsData {
  [positionAddress: string]: {
    collateral: AuroReward[];
    borrow: AuroReward[];
  };
}

export interface AuroPool {
  type: string;
  poolAddress: string;
  poolName: string;
  collateralTokenAddress?: string;
  collateralTokenSymbol?: string;
  supplyApr?: number;
  supplyIncentiveApr?: number;
  stakingApr?: number;
  totalSupplyApr?: number;
  borrowApr?: number;
  borrowIncentiveApr?: number;
  totalBorrowApr?: number;
  rewardPoolAddress?: string;
  borrowRewardsPoolAddress?: string;
  tvl?: number;
  ltvBps?: number;
  liquidationThresholdBps?: number;
  liquidationFeeBps?: number;
  borrowAmountFromPool?: number;
  token?: any;
}

// Store state interface
interface AuroState {
  // Data
  positions: AuroPosition[];
  rewards: AuroRewardsData;
  pools: AuroPool[];
  prices: Record<string, string>;
  
  // Loading states
  positionsLoading: boolean;
  rewardsLoading: boolean;
  poolsLoading: boolean;
  pricesLoading: boolean;
  
  // Error states
  positionsError: string | null;
  rewardsError: string | null;
  poolsError: string | null;
  pricesError: string | null;
  
  // Last update timestamps
  lastPositionsUpdate: number | null;
  lastRewardsUpdate: number | null;
  lastPoolsUpdate: number | null;
  lastPricesUpdate: number | null;
  
  // Actions
  fetchPositions: (address: string) => Promise<void>;
  fetchRewards: (address: string) => Promise<void>;
  fetchPools: () => Promise<void>;
  fetchPrices: (tokenAddresses: string[], forceRefresh?: boolean) => Promise<void>;
  
  // Getters
  getPosition: (address: string) => AuroPosition | undefined;
  getPositionRewards: (positionAddress: string) => AuroReward[];
  getTokenPrice: (tokenAddress: string) => string;
  getPool: (poolAddress: string) => AuroPool | undefined;
  
  // Utilities
  clearData: () => void;
  isDataStale: (maxAgeMs?: number) => boolean;
}

// Cache TTL constants
const CACHE_TTL = {
  POSITIONS: 5 * 60 * 1000, // 5 minutes
  REWARDS: 2 * 60 * 1000,   // 2 minutes
  POOLS: 10 * 60 * 1000,    // 10 minutes
  PRICES: 1 * 60 * 1000,    // 1 minute
};

export const useAuroStore = create<AuroState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        positions: [],
        rewards: {},
        pools: [],
        prices: {},
        
        positionsLoading: false,
        rewardsLoading: false,
        poolsLoading: false,
        pricesLoading: false,
        
        positionsError: null,
        rewardsError: null,
        poolsError: null,
        pricesError: null,
        
        lastPositionsUpdate: null,
        lastRewardsUpdate: null,
        lastPoolsUpdate: null,
        lastPricesUpdate: null,
        
        // Actions
        fetchPositions: async (address: string) => {
          const state = get();
          
          // Check if data is fresh
          if (state.lastPositionsUpdate && 
              Date.now() - state.lastPositionsUpdate < CACHE_TTL.POSITIONS) {
            console.log('[AuroStore] Using cached positions data');
            return;
          }
          
          set({ positionsLoading: true, positionsError: null });
          
          try {
            console.log('[AuroStore] Fetching positions for address:', address);
            const response = await fetch(`/api/protocols/auro/userPositions?address=${encodeURIComponent(address)}`);
            const data = await response.json();
            
            if (response.ok && data.success) {
              const positions = Array.isArray(data.positionInfo) ? data.positionInfo : [];
              set({
                positions,
                positionsLoading: false,
                lastPositionsUpdate: Date.now(),
                positionsError: null
              });
              console.log('[AuroStore] Positions fetched successfully:', positions.length);
            } else {
              throw new Error(data.error || 'Failed to fetch positions');
            }
          } catch (error) {
            console.error('[AuroStore] Error fetching positions:', error);
            set({
              positionsLoading: false,
              positionsError: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        },
        
        fetchRewards: async (address: string) => {
          const state = get();
          
          // Check if we have positions and pools data
          if (state.positions.length === 0 || state.pools.length === 0) {
            console.log('[AuroStore] No positions or pools data available for rewards');
            return;
          }
          
          // Check if data is fresh
          if (state.lastRewardsUpdate && 
              Date.now() - state.lastRewardsUpdate < CACHE_TTL.REWARDS) {
            console.log('[AuroStore] Using cached rewards data');
            return;
          }
          
          set({ rewardsLoading: true, rewardsError: null });
          
          try {
            console.log('[AuroStore] Fetching rewards for positions:', state.positions.length);
            
            // Format positions info
            const positionsInfo = state.positions.map(pos => ({
              address: pos.address,
              poolAddress: pos.poolAddress,
              debtAmount: pos.debtAmount
            }));
            
            // Format pools data
            const formattedPoolsData = state.pools.map(pool => ({
              type: pool.type,
              poolAddress: pool.poolAddress,
              rewardPoolAddress: pool.rewardPoolAddress,
              borrowRewardsPoolAddress: pool.borrowRewardsPoolAddress
            }));
            
            const requestBody = {
              positionsInfo,
              poolsData: formattedPoolsData
            };
            
            const response = await fetch('/api/protocols/auro/rewards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody)
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data) {
                set({
                  rewards: data.data,
                  rewardsLoading: false,
                  lastRewardsUpdate: Date.now(),
                  rewardsError: null
                });
                console.log('[AuroStore] Rewards fetched successfully');
              } else {
                throw new Error('Invalid rewards response format');
              }
            } else {
              throw new Error(`Rewards API error: ${response.status}`);
            }
          } catch (error) {
            console.error('[AuroStore] Error fetching rewards:', error);
            set({
              rewardsLoading: false,
              rewardsError: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        },
        
        fetchPools: async () => {
          const state = get();
          
          // Check if data is fresh
          if (state.lastPoolsUpdate && 
              Date.now() - state.lastPoolsUpdate < CACHE_TTL.POOLS) {
            console.log('[AuroStore] Using cached pools data');
            return;
          }
          
          set({ poolsLoading: true, poolsError: null });
          
          try {
            console.log('[AuroStore] Fetching pools data');
            const response = await fetch('/api/protocols/auro/pools');
            const data = await response.json();
            
            if (data.success && Array.isArray(data.data)) {
              set({
                pools: data.data,
                poolsLoading: false,
                lastPoolsUpdate: Date.now(),
                poolsError: null
              });
              console.log('[AuroStore] Pools fetched successfully:', data.data.length);
            } else {
              throw new Error('Invalid pools response format');
            }
          } catch (error) {
            console.error('[AuroStore] Error fetching pools:', error);
            set({
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
            console.log('[AuroStore] Using cached prices data');
            return;
          }
          
          set({ pricesLoading: true, pricesError: null });
          
          try {
            console.log('[AuroStore] Fetching prices for tokens:', tokenAddresses.length);
            
            // Use Panora API to fetch prices with safe import
            const { safeImport } = await import('@/lib/utils/safeImport');
            const { PanoraPricesService } = await safeImport(() => import('@/lib/services/panora/prices'));
            const pricesService = PanoraPricesService.getInstance();
            
            // Clean addresses
            const cleanAddresses = tokenAddresses.map(address => {
              let cleanAddress = address;
              if (cleanAddress.startsWith('@')) {
                cleanAddress = cleanAddress.slice(1);
              }
              if (!cleanAddress.startsWith('0x')) {
                cleanAddress = `0x${cleanAddress}`;
              }
              return cleanAddress;
            });
            
            // Fetch prices for Aptos chain (chainId: 1)
            const pricesData = await pricesService.getPrices(1, cleanAddresses);
            
            const prices: Record<string, string> = {};
            
            console.log('[AuroStore] Raw prices data:', pricesData);
            
            // Handle different response formats
            let tokensArray: any[] = [];
            if (pricesData && typeof pricesData === 'object') {
              if (Array.isArray(pricesData)) {
                tokensArray = pricesData;
              } else if (pricesData.data && Array.isArray(pricesData.data)) {
                tokensArray = pricesData.data;
              }
            }
            
            console.log('[AuroStore] Tokens array to process:', tokensArray);
            
            if (tokensArray.length > 0) {
              // Use utility function to create price map with both address versions
              const newPrices = createDualAddressPriceMap(tokensArray);
              Object.assign(prices, newPrices);
              console.log('[AuroStore] Added prices for', Object.keys(newPrices).length / 2, 'tokens');
            }
            
            console.log('[AuroStore] Final prices object:', prices);
            console.log('[AuroStore] Current state prices before update:', state.prices);
            
            const newPrices = { ...state.prices, ...prices };
            console.log('[AuroStore] New prices object after merge:', newPrices);
            
            set({
              prices: newPrices,
              pricesLoading: false,
              lastPricesUpdate: Date.now(),
              pricesError: null
            });
            
            // Verify the update
            const updatedState = get();
            console.log('[AuroStore] State prices after update:', updatedState.prices);
            console.log('[AuroStore] Prices fetched and saved successfully');
          } catch (error) {
            console.error('[AuroStore] Error fetching prices:', error);
            set({
              pricesLoading: false,
              pricesError: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        },
        
        // Getters
        getPosition: (address: string) => {
          return get().positions.find(pos => pos.address === address);
        },
        
        getPositionRewards: (positionAddress: string) => {
          const rewards = get().rewards[positionAddress];
          if (!rewards) return [];
          return [...rewards.collateral, ...rewards.borrow];
        },
        
        getTokenPrice: (tokenAddress: string) => {
          let cleanAddress = tokenAddress;
          if (cleanAddress.startsWith('@')) {
            cleanAddress = cleanAddress.slice(1);
          }
          if (!cleanAddress.startsWith('0x')) {
            cleanAddress = `0x${cleanAddress}`;
          }
          return get().prices[cleanAddress] || '0';
        },
        
        getPool: (poolAddress: string) => {
          return get().pools.find(pool => pool.poolAddress === poolAddress);
        },
        
        // Utilities
        clearData: () => {
          set({
            positions: [],
            rewards: {},
            pools: [],
            prices: {},
            lastPositionsUpdate: null,
            lastRewardsUpdate: null,
            lastPoolsUpdate: null,
            lastPricesUpdate: null,
            positionsError: null,
            rewardsError: null,
            poolsError: null,
            pricesError: null
          });
        },
        
        isDataStale: (maxAgeMs = CACHE_TTL.POSITIONS) => {
          const state = get();
          const now = Date.now();
          return !state.lastPositionsUpdate || (now - state.lastPositionsUpdate) > maxAgeMs;
        }
      }),
      {
        name: 'auro-storage',
        partialize: (state) => ({
          positions: state.positions,
          rewards: state.rewards,
          pools: state.pools,
          prices: state.prices,
          lastPositionsUpdate: state.lastPositionsUpdate,
          lastRewardsUpdate: state.lastRewardsUpdate,
          lastPoolsUpdate: state.lastPoolsUpdate,
          lastPricesUpdate: state.lastPricesUpdate
        })
      }
    )
  )
); 