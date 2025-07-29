import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Types for wallet data
export interface WalletBalance {
  asset_type: string;
  amount: string;
  last_transaction_timestamp: string;
}

export interface ProtocolPositions {
  [protocol: string]: any[];
}

export interface ProtocolRewards {
  [protocol: string]: any[];
}

export interface TokenPrices {
  [tokenAddress: string]: string;
}

// Cache TTL constants
const CACHE_TTL = {
  BALANCE: 30 * 1000,      // 30 seconds
  POSITIONS: 60 * 1000,    // 1 minute
  REWARDS: 30 * 1000,      // 30 seconds
  PRICES: 60 * 1000,       // 1 minute
} as const;

// Store state interface
interface WalletState {
  // Current wallet address
  address: string | null;
  
  // Data
  balance: WalletBalance[];
  positions: ProtocolPositions;
  rewards: ProtocolRewards;
  prices: TokenPrices;
  
  // Loading states
  balanceLoading: boolean;
  positionsLoading: boolean;
  rewardsLoading: boolean;
  pricesLoading: boolean;
  
  // Error states
  balanceError: string | null;
  positionsError: string | null;
  rewardsError: string | null;
  pricesError: string | null;
  
  // Timestamps
  lastBalanceUpdate: number | null;
  lastPositionsUpdate: number | null;
  lastRewardsUpdate: number | null;
  lastPricesUpdate: number | null;
  
  // Actions
  setAddress: (address: string | null) => void;
  fetchBalance: (address: string, forceRefresh?: boolean) => Promise<void>;
  fetchPositions: (address: string, protocols?: string[], forceRefresh?: boolean) => Promise<void>;
  fetchRewards: (address: string, protocols?: string[], forceRefresh?: boolean) => Promise<void>;
  fetchPrices: (tokenAddresses: string[], forceRefresh?: boolean) => Promise<void>;
  
  // Getters
  getBalance: () => WalletBalance[];
  getPositions: (protocol?: string) => any[];
  getRewards: (protocol?: string) => any[];
  getTokenPrice: (tokenAddress: string) => string;
  
  // Utilities
  clearData: () => void;
  isDataStale: (type: 'balance' | 'positions' | 'rewards' | 'prices') => boolean;
  getTotalValue: () => number;
}

// Create store
export const useWalletStore = create<WalletState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        address: null,
        balance: [],
        positions: {},
        rewards: {},
        prices: {},
        
        balanceLoading: false,
        positionsLoading: false,
        rewardsLoading: false,
        pricesLoading: false,
        
        balanceError: null,
        positionsError: null,
        rewardsError: null,
        pricesError: null,
        
        lastBalanceUpdate: null,
        lastPositionsUpdate: null,
        lastRewardsUpdate: null,
        lastPricesUpdate: null,
        
        // Actions
        setAddress: (address: string | null) => {
          const currentAddress = get().address;
          if (currentAddress !== address) {
            set({ address });
            if (!address) {
              get().clearData();
            }
          }
        },
        
        fetchBalance: async (address: string, forceRefresh = false) => {
          const state = get();
          
          // Check if data is fresh
          if (!forceRefresh && state.lastBalanceUpdate && 
              Date.now() - state.lastBalanceUpdate < CACHE_TTL.BALANCE) {
            console.log('[WalletStore] Using cached balance data');
            return;
          }
          
          set({ balanceLoading: true, balanceError: null });
          
          try {
            console.log('[WalletStore] Fetching balance for address:', address);
            
            const response = await fetch(`/api/aptos/walletBalance?address=${encodeURIComponent(address)}`);
            
            if (!response.ok) {
              throw new Error(`Balance API returned status ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.balances) {
              set({
                balance: data.balances,
                balanceLoading: false,
                lastBalanceUpdate: Date.now(),
                balanceError: null
              });
              console.log('[WalletStore] Balance fetched successfully:', data.balances.length);
            } else {
              set({
                balance: [],
                balanceLoading: false,
                lastBalanceUpdate: Date.now(),
                balanceError: null
              });
            }
          } catch (error) {
            console.error('[WalletStore] Error fetching balance:', error);
            set({
              balanceLoading: false,
              balanceError: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        },
        
        fetchPositions: async (address: string, protocols?: string[], forceRefresh = false) => {
          const state = get();
          
          // Check if data is fresh
          if (!forceRefresh && state.lastPositionsUpdate && 
              Date.now() - state.lastPositionsUpdate < CACHE_TTL.POSITIONS) {
            console.log('[WalletStore] Using cached positions data');
            return;
          }
          
          set({ positionsLoading: true, positionsError: null });
          
          try {
            console.log('[WalletStore] Fetching positions for address:', address);
            
            // Define protocols to fetch if not specified
            const protocolsToFetch = protocols || ['echelon', 'joule', 'hyperion', 'auro', 'aries', 'amnis'];
            const newPositions: ProtocolPositions = { ...state.positions };
            
            // Fetch positions for each protocol
            const promises = protocolsToFetch.map(async (protocol) => {
              try {
                const response = await fetch(`/api/protocols/${protocol}/userPositions?address=${encodeURIComponent(address)}`);
                
                if (response.ok) {
                  const data = await response.json();
                  newPositions[protocol] = data.data || data.userPositions || [];
                  console.log(`[WalletStore] ${protocol} positions fetched:`, newPositions[protocol].length);
                } else {
                  console.warn(`[WalletStore] Failed to fetch ${protocol} positions:`, response.status);
                  newPositions[protocol] = [];
                }
              } catch (error) {
                console.error(`[WalletStore] Error fetching ${protocol} positions:`, error);
                newPositions[protocol] = [];
              }
            });
            
            await Promise.all(promises);
            
            set({
              positions: newPositions,
              positionsLoading: false,
              lastPositionsUpdate: Date.now(),
              positionsError: null
            });
            
            console.log('[WalletStore] All positions fetched successfully');
          } catch (error) {
            console.error('[WalletStore] Error fetching positions:', error);
            set({
              positionsLoading: false,
              positionsError: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        },
        
        fetchRewards: async (address: string, protocols?: string[], forceRefresh = false) => {
          const state = get();
          
          // Check if data is fresh
          if (!forceRefresh && state.lastRewardsUpdate && 
              Date.now() - state.lastRewardsUpdate < CACHE_TTL.REWARDS) {
            console.log('[WalletStore] Using cached rewards data');
            return;
          }
          
          set({ rewardsLoading: true, rewardsError: null });
          
          try {
            console.log('[WalletStore] Fetching rewards for address:', address);
            
            // Define protocols to fetch if not specified
            const protocolsToFetch = protocols || ['echelon', 'auro'];
            const newRewards: ProtocolRewards = { ...state.rewards };
            
            // Fetch rewards for each protocol
            const promises = protocolsToFetch.map(async (protocol) => {
              try {
                const response = await fetch(`/api/protocols/${protocol}/rewards?address=${encodeURIComponent(address)}`);
                
                if (response.ok) {
                  const data = await response.json();
                  newRewards[protocol] = data.data || [];
                  console.log(`[WalletStore] ${protocol} rewards fetched:`, newRewards[protocol].length);
                } else {
                  console.warn(`[WalletStore] Failed to fetch ${protocol} rewards:`, response.status);
                  newRewards[protocol] = [];
                }
              } catch (error) {
                console.error(`[WalletStore] Error fetching ${protocol} rewards:`, error);
                newRewards[protocol] = [];
              }
            });
            
            await Promise.all(promises);
            
            set({
              rewards: newRewards,
              rewardsLoading: false,
              lastRewardsUpdate: Date.now(),
              rewardsError: null
            });
            
            console.log('[WalletStore] All rewards fetched successfully');
          } catch (error) {
            console.error('[WalletStore] Error fetching rewards:', error);
            set({
              rewardsLoading: false,
              rewardsError: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        },
        
        fetchPrices: async (tokenAddresses: string[], forceRefresh = false) => {
          const state = get();
          
          // Check if data is fresh
          if (!forceRefresh && state.lastPricesUpdate && 
              Date.now() - state.lastPricesUpdate < CACHE_TTL.PRICES) {
            console.log('[WalletStore] Using cached prices data');
            return;
          }
          
          set({ pricesLoading: true, pricesError: null });
          
          try {
            console.log('[WalletStore] Fetching prices for tokens:', tokenAddresses.length);
            
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
            
            // Use Panora API to fetch prices
            const { PanoraPricesService } = await import('@/lib/services/panora/prices');
            const pricesService = PanoraPricesService.getInstance();
            
            // Fetch prices for Aptos chain (chainId: 1)
            const pricesData = await pricesService.getPrices(1, cleanAddresses);
            
            const newPrices: TokenPrices = { ...state.prices };
            
            // Handle different response formats
            let tokensArray: any[] = [];
            if (pricesData && typeof pricesData === 'object') {
              if (Array.isArray(pricesData)) {
                tokensArray = pricesData;
              } else if (pricesData.data && Array.isArray(pricesData.data)) {
                tokensArray = pricesData.data;
              }
            }
            
            if (tokensArray.length > 0) {
              tokensArray.forEach((token: any) => {
                const address = token.tokenAddress || token.faAddress;
                const price = token.usdPrice;
                
                if (address && price) {
                  newPrices[address] = price;
                }
              });
            }
            
            set({
              prices: newPrices,
              pricesLoading: false,
              lastPricesUpdate: Date.now(),
              pricesError: null
            });
            
            console.log('[WalletStore] Prices fetched successfully');
          } catch (error) {
            console.error('[WalletStore] Error fetching prices:', error);
            set({
              pricesLoading: false,
              pricesError: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        },
        
        // Getters
        getBalance: () => {
          return get().balance;
        },
        
        getPositions: (protocol?: string) => {
          const state = get();
          if (protocol) {
            return state.positions[protocol] || [];
          }
          return Object.values(state.positions).flat();
        },
        
        getRewards: (protocol?: string) => {
          const state = get();
          if (protocol) {
            return state.rewards[protocol] || [];
          }
          return Object.values(state.rewards).flat();
        },
        
        getTokenPrice: (tokenAddress: string) => {
          const state = get();
          let cleanAddress = tokenAddress;
          if (cleanAddress.startsWith('@')) {
            cleanAddress = cleanAddress.slice(1);
          }
          if (!cleanAddress.startsWith('0x')) {
            cleanAddress = `0x${cleanAddress}`;
          }
          return state.prices[cleanAddress] || '0';
        },
        
        getTotalValue: () => {
          const state = get();
          // Calculate total value from positions and prices
          let total = 0;
          
          Object.values(state.positions).forEach(protocolPositions => {
            protocolPositions.forEach((position: any) => {
              // This is a simplified calculation - you might need to adjust based on your data structure
              if (position.value) {
                total += parseFloat(position.value) || 0;
              }
            });
          });
          
          return total;
        },
        
        // Utilities
        clearData: () => {
          set({
            address: null,
            balance: [],
            positions: {},
            rewards: {},
            prices: {},
            lastBalanceUpdate: null,
            lastPositionsUpdate: null,
            lastRewardsUpdate: null,
            lastPricesUpdate: null,
            balanceError: null,
            positionsError: null,
            rewardsError: null,
            pricesError: null
          });
        },
        
        isDataStale: (type: 'balance' | 'positions' | 'rewards' | 'prices') => {
          const state = get();
          const lastUpdate = state[`last${type.charAt(0).toUpperCase() + type.slice(1)}Update` as keyof WalletState] as number | null;
          const ttl = CACHE_TTL[type.toUpperCase() as keyof typeof CACHE_TTL];
          
          return !lastUpdate || Date.now() - lastUpdate > ttl;
        }
      }),
      {
        name: 'wallet-storage',
        partialize: (state) => ({
          address: state.address,
          balance: state.balance,
          positions: state.positions,
          rewards: state.rewards,
          prices: state.prices,
          lastBalanceUpdate: state.lastBalanceUpdate,
          lastPositionsUpdate: state.lastPositionsUpdate,
          lastRewardsUpdate: state.lastRewardsUpdate,
          lastPricesUpdate: state.lastPricesUpdate
        })
      }
    )
  )
); 