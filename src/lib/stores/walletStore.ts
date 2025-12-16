import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { getBaseUrl } from '@/lib/utils/config';

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
  [protocol: string]: any[] | Record<string, any>;
}

export interface TokenPrices {
  [tokenAddress: string]: string;
}

export interface ClaimableRewardsSummary {
  totalValue: number;
  protocols: {
    echelon: { value: number; count: number };
    auro: { value: number; count: number };
    hyperion: { value: number; count: number };
    meso: { value: number; count: number };
    earnium: { value: number; count: number };
    moar: { value: number; count: number };
  };
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
  totalAssets: number;
  
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
  setRewards: (protocol: string, rewards: any[]) => void;
  setTotalAssets: (value: number) => void;
  
  // Getters
  getBalance: () => WalletBalance[];
  getPositions: (protocol?: string) => any[];
  getRewards: (protocol?: string) => any[];
  getTokenPrice: (tokenAddress: string) => string;
  getClaimableRewardsSummary: () => Promise<ClaimableRewardsSummary>;
  
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
        totalAssets: 0,
        
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
        setTotalAssets: (value: number) => {
          if (Number.isFinite(value)) {
            set({ totalAssets: value });
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
            const apiUrl = `${getBaseUrl()}/api/aptos/walletBalance?address=${encodeURIComponent(address)}`;
            console.log('[WalletStore] Balance API URL:', apiUrl);
            
            const response = await fetch(apiUrl);
            
            if (response.ok) {
              const data = await response.json();
              set({
                balance: data.balances || [],
                balanceLoading: false,
                lastBalanceUpdate: Date.now(),
                balanceError: null
              });
              console.log('[WalletStore] Balance fetched successfully:', data.balances.length);
            } else {
              console.warn('[WalletStore] Failed to fetch balance:', response.status, response.statusText);
              console.warn('[WalletStore] Failed URL:', apiUrl);
              throw new Error(`Failed to fetch balance: ${response.statusText}`);
            }
          } catch (error) {
            console.error('[WalletStore] Error fetching balance:', error);
            console.error('[WalletStore] Address:', address, 'Base URL:', getBaseUrl());
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
            console.log('[WalletStore] Base URL:', getBaseUrl());
            
            // Define protocols to fetch if not specified (expanded list to cover all supported)
            const protocolsToFetch = protocols || [
              'echelon',
              'joule',
              'hyperion',
              'auro',
              'aries',
              'amnis',
              'tapp',
              'meso',
              'earnium',
              'aave',
              'moar',
            ];
            const newPositions: ProtocolPositions = { ...state.positions };
            
            // Fetch positions for each protocol
            const promises = protocolsToFetch.map(async (protocol) => {
              try {
                const apiUrl = `${getBaseUrl()}/api/protocols/${protocol}/userPositions?address=${encodeURIComponent(address)}`;
                console.log(`[WalletStore] Fetching ${protocol} positions from:`, apiUrl);
                
                const response = await fetch(apiUrl);
                
                if (response.ok) {
                  const data = await response.json();
                  newPositions[protocol] = data.data || data.userPositions || [];
                  console.log(`[WalletStore] ${protocol} positions fetched:`, newPositions[protocol].length);
                } else {
                  console.warn(`[WalletStore] Failed to fetch ${protocol} positions:`, response.status, response.statusText);
                  console.warn(`[WalletStore] Failed URL:`, apiUrl);
                  newPositions[protocol] = [];
                }
              } catch (error) {
                console.error(`[WalletStore] Error fetching ${protocol} positions:`, error);
                console.error(`[WalletStore] Protocol: ${protocol}, Address: ${address}, Base URL: ${getBaseUrl()}`);
                newPositions[protocol] = [];
              }
            });
            
            await Promise.all(promises);
            
            // Log summary of loaded positions
            console.log('[WalletStore] Positions loading summary:');
            Object.entries(newPositions).forEach(([protocol, positions]) => {
              console.log(`[WalletStore] ${protocol}: ${positions.length} positions`);
            });
            
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
            console.log('[WalletStore] Base URL:', getBaseUrl());
            console.log('[WalletStore] Environment check:', {
              NODE_ENV: process.env.NODE_ENV,
              NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
              VERCEL_URL: process.env.VERCEL_URL
            });
            
            // Define protocols to fetch if not specified
            const protocolsToFetch = protocols || ['echelon', 'auro', 'hyperion', 'meso', 'earnium'];
            const newRewards: ProtocolRewards = { ...state.rewards };
            
            console.log('[WalletStore] Protocols to fetch:', protocolsToFetch);
            
            // Fetch rewards for each protocol
            const promises = protocolsToFetch.map(async (protocol) => {
              try {
                const apiUrl = `${getBaseUrl()}/api/protocols/${protocol}/rewards?address=${encodeURIComponent(address)}`;
                console.log(`[WalletStore] Fetching ${protocol} rewards from:`, apiUrl);
                
                if (protocol === 'hyperion') {
                  // Hyperion rewards are embedded in positions data
                  const hyperionUrl = `${getBaseUrl()}/api/protocols/${protocol}/userPositions?address=${encodeURIComponent(address)}`;
                  console.log(`[WalletStore] Hyperion using positions URL:`, hyperionUrl);
                  
                  const response = await fetch(hyperionUrl);
                  
                  if (response.ok) {
                    const data = await response.json();
                    const positions = data.data || [];
                    
                    // Extract rewards from positions
                    const rewards = positions.flatMap((position: any) => {
                      const farmRewards = position.farm?.unclaimed || [];
                      const feeRewards = position.fees?.unclaimed || [];
                      return [...farmRewards, ...feeRewards];
                    });
                    
                    newRewards[protocol] = rewards;
                    console.log(`[WalletStore] ${protocol} rewards extracted from positions:`, rewards.length);
                  } else {
                    console.warn(`[WalletStore] Failed to fetch ${protocol} positions:`, response.status, response.statusText);
                    console.warn(`[WalletStore] Failed URL:`, hyperionUrl);
                    newRewards[protocol] = [];
                  }
                } else if (protocol === 'meso') {
                  // Meso rewards via dedicated API
                  const response = await fetch(`${getBaseUrl()}/api/protocols/meso/rewards?address=${encodeURIComponent(address)}`);
                  
                  if (response.ok) {
                    const data = await response.json();
                    // Store as flat array of rewards
                    newRewards[protocol] = (data?.rewards && Array.isArray(data.rewards)) ? data.rewards : [];
                    console.log(`[WalletStore] ${protocol} rewards fetched:`, (newRewards[protocol] as any[]).length);
                  } else {
                    console.warn(`[WalletStore] Failed to fetch ${protocol} rewards:`, response.status, response.statusText);
                    console.warn(`[WalletStore] Failed URL:`, apiUrl);
                    newRewards[protocol] = [];
                  }
                } else if (protocol === 'earnium') {
                  // Earnium rewards via dedicated API
                  const response = await fetch(`${getBaseUrl()}/api/protocols/earnium/rewards?address=${encodeURIComponent(address)}`);
                  
                  if (response.ok) {
                    const data = await response.json();
                    // Store as array of pools
                    newRewards[protocol] = (data?.data && Array.isArray(data.data)) ? data.data : [];
                    console.log(`[WalletStore] ${protocol} rewards fetched:`, (newRewards[protocol] as any[]).length);
                  } else {
                    console.warn(`[WalletStore] Failed to fetch ${protocol} rewards:`, response.status, response.statusText);
                    console.warn(`[WalletStore] Failed URL:`, apiUrl);
                    newRewards[protocol] = [];
                  }
                } else {
                  // Standard rewards API for echelon and auro
                  console.log(`[WalletStore] Making request to:`, apiUrl);
                  const startTime = Date.now();
                  
                  const response = await fetch(apiUrl);
                  const endTime = Date.now();
                  
                  console.log(`[WalletStore] ${protocol} response received in ${endTime - startTime}ms:`, {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries())
                  });
                  
                  if (response.ok) {
                    const data = await response.json();
                    console.log(`[WalletStore] ${protocol} response data:`, data);
                    
                    // For Auro, data.data is an object with position addresses as keys
                    // For Echelon, data.data is an array
                    if (protocol === 'auro') {
                      newRewards[protocol] = data.data || {};
                      console.log(`[WalletStore] Auro rewards structure:`, {
                        hasData: !!data.data,
                        dataType: typeof data.data,
                        keys: data.data ? Object.keys(data.data) : [],
                        totalPositions: data.data ? Object.keys(data.data).length : 0
                      });
                      
                    } else {
                      newRewards[protocol] = data.data || [];
                      console.log(`[WalletStore] ${protocol} rewards fetched:`, {
                        count: newRewards[protocol].length,
                        sample: newRewards[protocol].slice(0, 2)
                      });
                    }
                  } else {
                    console.warn(`[WalletStore] Failed to fetch ${protocol} rewards:`, response.status, response.statusText);
                    console.warn(`[WalletStore] Failed URL:`, apiUrl);
                    
                    // Try to get response text for more details
                    try {
                      const errorText = await response.text();
                      console.warn(`[WalletStore] ${protocol} error response body:`, errorText);
                    } catch (e) {
                      console.warn(`[WalletStore] Could not read error response body:`, e);
                    }
                    
                    newRewards[protocol] = protocol === 'auro' ? {} : [];
                  }
                }
              } catch (error) {
                console.error(`[WalletStore] Error fetching ${protocol} rewards:`, error);
                console.error(`[WalletStore] Protocol: ${protocol}, Address: ${address}, Base URL: ${getBaseUrl()}`);
                
                // Log more details about the error
                if (error instanceof Error) {
                  console.error(`[WalletStore] Error details:`, {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                  });
                }
                
                newRewards[protocol] = [];
              }
            });
            
            console.log('[WalletStore] Waiting for all promises to resolve...');
            await Promise.all(promises);
            
            // Log summary of loaded rewards
            console.log('[WalletStore] Rewards loading summary:');
            Object.entries(newRewards).forEach(([protocol, rewards]) => {
              if (Array.isArray(rewards)) {
                console.log(`[WalletStore] ${protocol}: ${rewards.length} rewards`);
              } else if (typeof rewards === 'object' && rewards !== null) {
                const count = Object.keys(rewards).length;
                console.log(`[WalletStore] ${protocol}: ${count} positions with rewards`);
              } else {
                console.log(`[WalletStore] ${protocol}: no rewards data`);
              }
            });
            
            // Collect token addresses for price fetching
            const tokenAddresses: string[] = [];
            
            // Extract token addresses from rewards for price calculation
            Object.values(newRewards).forEach((rewards, protocolIndex) => {
              const protocol = Object.keys(newRewards)[protocolIndex];
              
              if (protocol === 'auro') {
                // Auro rewards have special structure: { positionAddress: { collateral: [], borrow: [] } }
                Object.values(rewards).forEach((positionRewards: any) => {
                  if (positionRewards && typeof positionRewards === 'object') {
                    // Process collateral rewards
                    if (positionRewards.collateral && Array.isArray(positionRewards.collateral)) {
                      positionRewards.collateral.forEach((reward: any) => {
                        if (reward && reward.key) {
                          // Auro rewards have 'key' field with token address
                          try {
                            // Clean the address from reward.key (it's a token address, not symbol)
                            let cleanAddress = reward.key;
                            if (cleanAddress.startsWith('@')) {
                              cleanAddress = cleanAddress.slice(1);
                            }
                            if (!cleanAddress.startsWith('0x')) {
                              cleanAddress = `0x${cleanAddress}`;
                            }
                            tokenAddresses.push(cleanAddress);
                          } catch (error) {
                            console.warn('Failed to get token address for Auro collateral reward:', reward.key);
                          }
                        }
                      });
                    }
                    
                    // Process borrow rewards
                    if (positionRewards.borrow && Array.isArray(positionRewards.borrow)) {
                      positionRewards.borrow.forEach((reward: any) => {
                        if (reward && reward.key) {
                          // Auro rewards have 'key' field with token address
                          try {
                            // Clean the address from reward.key (it's a token address, not symbol)
                            let cleanAddress = reward.key;
                            if (cleanAddress.startsWith('@')) {
                              cleanAddress = cleanAddress.slice(1);
                            }
                            if (!cleanAddress.startsWith('0x')) {
                              cleanAddress = `0x${cleanAddress}`;
                            }
                            tokenAddresses.push(cleanAddress);
                          } catch (error) {
                            console.warn('Failed to get token address for Auro borrow reward:', reward.key);
                          }
                        }
                      });
                    }
                  }
                });
              } else {
                // Standard processing for other protocols (echelon, hyperion)
                rewards.forEach((reward: any) => {
                  if (reward.tokenType && reward.tokenType !== 'Unknown') {
                    // Clean the address
                    let cleanAddress = reward.tokenType;
                    if (cleanAddress.startsWith('@')) {
                      cleanAddress = cleanAddress.slice(1);
                    }
                    if (!cleanAddress.startsWith('0x')) {
                      cleanAddress = `0x${cleanAddress}`;
                    }
                    tokenAddresses.push(cleanAddress);
                  }
                  
                  // Also try to get address by symbol as fallback
                  if (reward.token) {
                    try {
                      const tokenList = require('@/lib/data/tokenList.json');
                      const tokenInfo = tokenList.data.data.find((token: any) => 
                        token.symbol.toLowerCase() === reward.token.toLowerCase()
                      );
                      if (tokenInfo) {
                        const tokenAddress = tokenInfo.faAddress || tokenInfo.tokenAddress;
                        if (tokenAddress) {
                          // Clean the address
                          let cleanAddress = tokenAddress;
                          if (cleanAddress.startsWith('@')) {
                            cleanAddress = cleanAddress.slice(1);
                          }
                          if (!cleanAddress.startsWith('0x')) {
                            cleanAddress = `0x${cleanAddress}`;
                          }
                          tokenAddresses.push(cleanAddress);
                        }
                      }
                    } catch (error) {
                      console.warn('Failed to get token address for symbol:', reward.token);
                    }
                  }
                });
              }
            });
            
            // Fetch prices if we have token addresses
            if (tokenAddresses.length > 0) {
              // Remove duplicates
              const uniqueTokenAddresses = [...new Set(tokenAddresses)];
              console.log('[WalletStore] Fetching prices for', uniqueTokenAddresses.length, 'tokens');
              console.log('[WalletStore] Token addresses for prices:', uniqueTokenAddresses);
              await get().fetchPrices(uniqueTokenAddresses);
            } else {
              console.log('[WalletStore] No token addresses found for price fetching');
            }
            
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
            // Fetch prices for tokens
            
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
            
            // Handle Panora API response format
            if (pricesData && typeof pricesData === 'object') {
              // Panora API returns prices as a map of address -> price
              if (pricesData.data && typeof pricesData.data === 'object') {
                const fetchedPrices = pricesData.data;
                
                for (const address in fetchedPrices) {
                  const price = fetchedPrices[address];
                  
                  if (address && price !== undefined && price !== null) {
                    newPrices[address] = price;
                  }
                }
              }
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
            const rewards = state.rewards[protocol];
            if (Array.isArray(rewards)) {
              return rewards;
            } else if (typeof rewards === 'object' && rewards !== null) {
              // For Auro rewards, flatten the object structure
              return Object.values(rewards).flat();
            }
            return [];
          }
          return Object.values(state.rewards).flatMap(rewards => {
            if (Array.isArray(rewards)) {
              return rewards;
            } else if (typeof rewards === 'object' && rewards !== null) {
              return Object.values(rewards).flat();
            }
            return [];
          });
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
        
        getClaimableRewardsSummary: async () => {
          const state = get();
          console.log('[WalletStore] getClaimableRewardsSummary called');
          console.log('[WalletStore] Current rewards state:', {
            echelon: state.rewards.echelon,
            auro: state.rewards.auro,
            hyperion: state.rewards.hyperion,
            meso: state.rewards.meso,
            earnium: state.rewards.earnium
          });
          
          // DEBUG: Log all available prices (can be removed after testing)
          console.log('[WalletStore] Available prices:', {
            count: Object.keys(state.prices).length,
            addresses: Object.keys(state.prices),
            sample: Object.entries(state.prices).slice(0, 5)
          });
          
          // Helper function to get Echelon token prices directly from Panora
          const getEchelonTokenPrices = async (rewards: any[]) => {
            try {
              const { PanoraPricesService } = await import('@/lib/services/panora/prices');
              const pricesService = PanoraPricesService.getInstance();
              
              // Collect unique token addresses from rewards
              const addresses = new Set<string>();
              rewards.forEach((reward: any) => {
                if (reward.tokenType && reward.tokenType !== 'Unknown') {
                  let cleanAddress = reward.tokenType;
                  if (cleanAddress.startsWith('@')) {
                    cleanAddress = cleanAddress.slice(1);
                  }
                  if (!cleanAddress.startsWith('0x')) {
                    cleanAddress = `0x${cleanAddress}`;
                  }
                  addresses.add(cleanAddress);
                }
              });
              
              const uniqueAddresses = Array.from(addresses);
              if (uniqueAddresses.length === 0) return {};
              
              console.log('[WalletStore] Fetching Echelon prices for addresses:', uniqueAddresses);
              const response = await pricesService.getPrices(1, uniqueAddresses);
              
              const prices: Record<string, string> = {};
              if (response.data) {
                response.data.forEach((price: any) => {
                  if (price.tokenAddress) {
                    prices[price.tokenAddress] = price.usdPrice;
                  }
                  if (price.faAddress) {
                    prices[price.faAddress] = price.usdPrice;
                  }
                });
              }
              
              console.log('[WalletStore] Echelon prices fetched:', prices);
              return prices;
            } catch (error) {
              console.error('[WalletStore] Error fetching Echelon prices:', error);
              return {};
            }
          };

          // Helper function to get Auro token prices directly from Panora
          const getAuroTokenPrices = async (auroRewards: Record<string, any>) => {
            try {
              const { PanoraPricesService } = await import('@/lib/services/panora/prices');
              const pricesService = PanoraPricesService.getInstance();
              
              // Collect unique token addresses from auro rewards
              const addresses = new Set<string>();
              Object.values(auroRewards).forEach((positionRewards: any) => {
                if (positionRewards.collateral) {
                  positionRewards.collateral.forEach((reward: any) => {
                    if (reward?.key) {
                      let cleanAddress = reward.key;
                      if (cleanAddress.startsWith('@')) {
                        cleanAddress = cleanAddress.slice(1);
                      }
                      if (!cleanAddress.startsWith('0x')) {
                        cleanAddress = `0x${cleanAddress}`;
                      }
                      addresses.add(cleanAddress);
                    }
                  });
                }
                if (positionRewards.borrow) {
                  positionRewards.borrow.forEach((reward: any) => {
                    if (reward?.key) {
                      let cleanAddress = reward.key;
                      if (cleanAddress.startsWith('@')) {
                        cleanAddress = cleanAddress.slice(1);
                      }
                      if (!cleanAddress.startsWith('0x')) {
                        cleanAddress = `0x${cleanAddress}`;
                      }
                      addresses.add(cleanAddress);
                    }
                  });
                }
              });
              
              const uniqueAddresses = Array.from(addresses);
              if (uniqueAddresses.length === 0) return {};
              
              console.log('[WalletStore] Fetching Auro prices for addresses:', uniqueAddresses);
              const response = await pricesService.getPrices(1, uniqueAddresses);
              
              const prices: Record<string, string> = {};
              if (response.data) {
                response.data.forEach((price: any) => {
                  if (price.tokenAddress) {
                    prices[price.tokenAddress] = price.usdPrice;
                  }
                  if (price.faAddress) {
                    prices[price.faAddress] = price.usdPrice;
                  }
                });
              }
              
              console.log('[WalletStore] Auro prices fetched:', prices);
              return prices;
            } catch (error) {
              console.error('[WalletStore] Error fetching Auro prices:', error);
              return {};
            }
          };

          // Helper function to get Earnium token prices directly from Panora
          const getEarniumTokenPrices = async (earniumRewards: any[]) => {
            try {
              const { PanoraPricesService } = await import('@/lib/services/panora/prices');
              const pricesService = PanoraPricesService.getInstance();
              
              // Collect unique token addresses from earnium rewards
              const addresses = new Set<string>();
              earniumRewards.forEach((pool: any) => {
                if (pool.rewards && Array.isArray(pool.rewards)) {
                  pool.rewards.forEach((reward: any) => {
                    if (reward.tokenKey) {
                      let cleanAddress = reward.tokenKey;
                      if (cleanAddress.startsWith('@')) {
                        cleanAddress = cleanAddress.slice(1);
                      }
                      if (!cleanAddress.startsWith('0x')) {
                        cleanAddress = `0x${cleanAddress}`;
                      }
                      addresses.add(cleanAddress);
                    }
                  });
                }
              });
              
              const uniqueAddresses = Array.from(addresses);
              if (uniqueAddresses.length === 0) return {};
              
              console.log('[WalletStore] Fetching Earnium prices for addresses:', uniqueAddresses);
              const response = await pricesService.getPrices(1, uniqueAddresses);
              
              const prices: Record<string, string> = {};
              if (response.data) {
                response.data.forEach((price: any) => {
                  if (price.tokenAddress) {
                    prices[price.tokenAddress] = price.usdPrice;
                  }
                  if (price.faAddress) {
                    prices[price.faAddress] = price.usdPrice;
                  }
                });
              }
              
              console.log('[WalletStore] Earnium prices fetched:', prices);
              return prices;
            } catch (error) {
              console.error('[WalletStore] Error fetching Earnium prices:', error);
              return {};
            }
          };
          
          const summary: ClaimableRewardsSummary = {
            totalValue: 0,
            protocols: {
              echelon: { value: 0, count: 0 },
              auro: { value: 0, count: 0 },
              hyperion: { value: 0, count: 0 },
              meso: { value: 0, count: 0 },
              earnium: { value: 0, count: 0 },
              moar: { value: 0, count: 0 }
            }
          };
          
          // Process Echelon rewards
          const echelonRewards = Array.isArray(state.rewards.echelon) ? state.rewards.echelon : [];
          console.log('[WalletStore] Processing Echelon rewards:', {
            count: echelonRewards.length,
            sample: echelonRewards.slice(0, 2)
          });
          
          // DEBUG: Log detailed Echelon reward structure (can be removed after testing)
          if (echelonRewards.length > 0) {
            console.log('[WalletStore] Echelon rewards detailed structure:', echelonRewards.map((r: any) => ({
              token: r.token,
              tokenType: r.tokenType,
              amount: r.amount,
              rewardName: r.rewardName
            })));
          }
          
          // Get Echelon token prices directly from Panora API
          let echelonPrices: Record<string, string> = {};
          if (echelonRewards.length > 0) {
            echelonPrices = await getEchelonTokenPrices(echelonRewards);
          }
          
          echelonRewards.forEach((reward: any) => {
            if (reward.amount && reward.amount > 0) {
              
              let tokenAddress = null;
              let price = '0';
              
              console.log(`[WalletStore] Processing Echelon reward:`, {
                token: reward.token,
                tokenType: reward.tokenType,
                amount: reward.amount
              });
              
              // First, try to use tokenType directly if it's a valid address
              if (reward.tokenType && reward.tokenType !== 'Unknown') {
                // Clean the address
                let cleanAddress = reward.tokenType;
                if (cleanAddress.startsWith('@')) {
                  cleanAddress = cleanAddress.slice(1);
                }
                if (!cleanAddress.startsWith('0x')) {
                  cleanAddress = `0x${cleanAddress}`;
                }
                
                console.log(`[WalletStore] Cleaned address: ${cleanAddress}`);
                
                // Check direct prices first, then fallback to store prices
                if (echelonPrices[cleanAddress]) {
                  tokenAddress = cleanAddress;
                  price = echelonPrices[cleanAddress];
                  console.log(`[WalletStore] Found direct price: ${price}`);
                } else if (state.prices[cleanAddress]) {
                  tokenAddress = cleanAddress;
                  price = state.prices[cleanAddress];
                  console.log(`[WalletStore] Found price in store: ${price}`);
                } else {
                  console.log(`[WalletStore] No price found for address: ${cleanAddress}`);
                }
              }
              
              // If no price found by tokenType, try to find by symbol in token list
              if (!tokenAddress) {
                console.log(`[WalletStore] Trying symbol fallback for: ${reward.token}`);
                const tokenSymbol = reward.token;
                const tokenList = require('@/lib/data/tokenList.json');
                const tokenInfo = tokenList.data.data.find((token: any) => 
                  token.symbol.toLowerCase() === tokenSymbol.toLowerCase()
                );
                
                if (tokenInfo) {
                  console.log(`[WalletStore] Found token info:`, tokenInfo);
                  tokenAddress = tokenInfo.faAddress || tokenInfo.tokenAddress;
                  if (tokenAddress) {
                    // Clean the address
                    if (tokenAddress.startsWith('@')) {
                      tokenAddress = tokenAddress.slice(1);
                    }
                    if (!tokenAddress.startsWith('0x')) {
                      tokenAddress = `0x${tokenAddress}`;
                    }
                    console.log(`[WalletStore] Fallback address: ${tokenAddress}`);
                    
                    // Check direct prices first, then fallback to store prices
                    if (echelonPrices[tokenAddress]) {
                      price = echelonPrices[tokenAddress];
                      console.log(`[WalletStore] Found direct fallback price: ${price}`);
                    } else {
                      price = state.prices[tokenAddress] || '0';
                      console.log(`[WalletStore] Found store fallback price: ${price}`);
                    }
                  }
                } else {
                  console.log(`[WalletStore] No token info found for symbol: ${tokenSymbol}`);
                }
              }
              
              if (tokenAddress && parseFloat(price) > 0) {
                const value = reward.amount * parseFloat(price);
                summary.protocols.echelon.value += value;
                summary.protocols.echelon.count++;
                console.log(`[WalletStore] Echelon reward processed:`, {
                  token: reward.token,
                  amount: reward.amount,
                  price: price,
                  value: value
                });
              } else {
                console.log(`[WalletStore] Echelon reward skipped (no price):`, {
                  token: reward.token,
                  amount: reward.amount,
                  tokenAddress: tokenAddress,
                  price: price,
                  reason: !tokenAddress ? 'No token address found' : 'Price is 0 or invalid'
                });
              }
            }
          });
          
          // Process Auro rewards
          const auroRewards = typeof state.rewards.auro === 'object' && !Array.isArray(state.rewards.auro) ? state.rewards.auro : {};
          console.log('[WalletStore] Processing Auro rewards:', {
            type: typeof auroRewards,
            keys: Object.keys(auroRewards),
            sample: Object.entries(auroRewards).slice(0, 2)
          });
          
          // Get Auro token prices directly from Panora API
          let auroPrices: Record<string, string> = {};
          if (Object.keys(auroRewards).length > 0) {
            auroPrices = await getAuroTokenPrices(auroRewards);
          }
          
          // Auro rewards are structured as { positionAddress: { collateral: [], borrow: [] } }
          Object.values(auroRewards).forEach((positionRewards: any) => {
            if (positionRewards && typeof positionRewards === 'object') {
              // Process collateral rewards
              if (positionRewards.collateral && Array.isArray(positionRewards.collateral)) {
                positionRewards.collateral.forEach((reward: any) => {
                  if (reward && reward.key && reward.value && parseFloat(reward.value) > 0) {
                    // Get token info to calculate proper amount
                    try {
                      const tokenList = require('@/lib/data/tokenList.json');
                      
                      // Clean the address from reward.key (it's a token address, not symbol)
                      let cleanAddress = reward.key;
                      if (cleanAddress.startsWith('@')) {
                        cleanAddress = cleanAddress.slice(1);
                      }
                      if (!cleanAddress.startsWith('0x')) {
                        cleanAddress = `0x${cleanAddress}`;
                      }
                      
                      console.log(`[WalletStore] Processing Auro collateral reward:`, {
                        key: reward.key,
                        cleanAddress: cleanAddress,
                        value: reward.value
                      });
                      
                      // Find token by address
                      const tokenInfo = tokenList.data.data.find((token: any) => 
                        (token.tokenAddress === cleanAddress || token.faAddress === cleanAddress)
                      );
                      
                      if (tokenInfo) {
                        const decimals = tokenInfo.decimals || 8;
                        const amount = parseFloat(reward.value) / Math.pow(10, decimals);
                        
                        // Check direct prices first, then fallback to store prices
                        let price = '0';
                        if (auroPrices[cleanAddress]) {
                          price = auroPrices[cleanAddress];
                          console.log(`[WalletStore] Found direct Auro price: ${price}`);
                        } else if (state.prices[cleanAddress]) {
                          price = state.prices[cleanAddress];
                          console.log(`[WalletStore] Found store price: ${price}`);
                        } else {
                          console.log(`[WalletStore] No price found for address: ${cleanAddress}`);
                        }
                        
                        if (parseFloat(price) > 0) {
                          const value = amount * parseFloat(price);
                          summary.protocols.auro.value += value;
                          summary.protocols.auro.count++;
                          console.log(`[WalletStore] Auro collateral reward processed:`, {
                            token: tokenInfo.symbol,
                            amount: amount,
                            price: price,
                            value: value
                          });
                        } else {
                          console.log(`[WalletStore] Auro collateral reward skipped (no price):`, {
                            token: tokenInfo.symbol,
                            amount: amount,
                            address: cleanAddress,
                            reason: 'Price is 0 or not found'
                          });
                        }
                      } else {
                        console.log(`[WalletStore] No token info found for address: ${cleanAddress}`);
                      }
                    } catch (error) {
                      console.warn('Failed to process Auro collateral reward:', reward.key, error);
                    }
                  }
                });
              }
              
              // Process borrow rewards
              if (positionRewards.borrow && Array.isArray(positionRewards.borrow)) {
                positionRewards.borrow.forEach((reward: any) => {
                  if (reward && reward.key && reward.value && parseFloat(reward.value) > 0) {
                    // Get token info to calculate proper amount
                    try {
                      const tokenList = require('@/lib/data/tokenList.json');
                      
                      // Clean the address from reward.key (it's a token address, not symbol)
                      let cleanAddress = reward.key;
                      if (cleanAddress.startsWith('@')) {
                        cleanAddress = cleanAddress.slice(1);
                      }
                      if (!cleanAddress.startsWith('0x')) {
                        cleanAddress = `0x${cleanAddress}`;
                      }
                      
                      console.log(`[WalletStore] Processing Auro borrow reward:`, {
                        key: reward.key,
                        cleanAddress: cleanAddress,
                        value: reward.value
                      });
                      
                      // Find token by address
                      const tokenInfo = tokenList.data.data.find((token: any) => 
                        (token.tokenAddress === cleanAddress || token.faAddress === cleanAddress)
                      );
                      
                      if (tokenInfo) {
                        const decimals = tokenInfo.decimals || 8;
                        const amount = parseFloat(reward.value) / Math.pow(10, decimals);
                        
                        // Check direct prices first, then fallback to store prices
                        let price = '0';
                        if (auroPrices[cleanAddress]) {
                          price = auroPrices[cleanAddress];
                          console.log(`[WalletStore] Found direct Auro price: ${price}`);
                        } else if (state.prices[cleanAddress]) {
                          price = state.prices[cleanAddress];
                          console.log(`[WalletStore] Found store price: ${price}`);
                        } else {
                          console.log(`[WalletStore] No price found for address: ${cleanAddress}`);
                        }
                        
                        if (parseFloat(price) > 0) {
                          const value = amount * parseFloat(price);
                          summary.protocols.auro.value += value;
                          summary.protocols.auro.count++;
                          console.log(`[WalletStore] Auro borrow reward processed:`, {
                            token: tokenInfo.symbol,
                            amount: amount,
                            price: price,
                            value: value
                          });
                        } else {
                          console.log(`[WalletStore] Auro borrow reward skipped (no price):`, {
                            token: tokenInfo.symbol,
                            amount: amount,
                            address: cleanAddress,
                            reason: 'Price is 0 or not found'
                          });
                        }
                      } else {
                        console.log(`[WalletStore] No token info found for address: ${cleanAddress}`);
                      }
                    } catch (error) {
                      console.warn('Failed to process Auro borrow reward:', reward.key, error);
                    }
                  }
                });
              }
            }
          });
          
          // Process Hyperion rewards (calculate by positions, not individual rewards)
          const hyperionPositions = state.positions.hyperion || [];
          console.log('[WalletStore] Processing Hyperion positions:', {
            count: hyperionPositions.length,
            sample: hyperionPositions.slice(0, 2)
          });
          
          if (hyperionPositions.length > 0) {
            // Use positions data if available
            hyperionPositions.forEach((position: any) => {
              const farmRewards = position.farm?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
              const feeRewards = position.fees?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
              const totalRewards = farmRewards + feeRewards;
              
              if (totalRewards > 0) {
                summary.protocols.hyperion.value += totalRewards;
                summary.protocols.hyperion.count++;
                console.log(`[WalletStore] Hyperion position processed:`, {
                  positionId: position.position?.objectId?.slice(0, 8),
                  farmRewards: farmRewards,
                  feeRewards: feeRewards,
                  totalRewards: totalRewards
                });
              }
            });
          } else {
            // Fallback to rewards data if positions not available
            const hyperionRewards = Array.isArray(state.rewards.hyperion) ? state.rewards.hyperion : [];
            if (hyperionRewards.length > 0) {
              // For fallback, we estimate 1 position per reward group
              // This is not perfect but better than showing 0
              let totalValue = 0;
              hyperionRewards.forEach((reward: any) => {
                if (reward.amountUSD && parseFloat(reward.amountUSD) > 0) {
                  totalValue += parseFloat(reward.amountUSD);
                }
              });
              
              if (totalValue > 0) {
                summary.protocols.hyperion.value = totalValue;
                summary.protocols.hyperion.count = 1; // Conservative estimate
              }
            }
          }
          
          // Process Meso rewards (array from API; already in USD per item)
          const mesoRewards = Array.isArray(state.rewards.meso) ? state.rewards.meso : [];
          console.log('[WalletStore] Processing Meso rewards:', {
            count: mesoRewards.length,
            sample: mesoRewards.slice(0, 2)
          });
          
          if (Array.isArray(mesoRewards) && mesoRewards.length > 0) {
            let mesoTotal = 0;
            mesoRewards.forEach((reward: any) => {
              const usd = typeof reward.usdValue === 'number' ? reward.usdValue : 0;
              const amt = typeof reward.amount === 'number' ? reward.amount : 0;
              // Count rewards by token amount > 0 to include sub-cent USD values
              if (amt > 0) {
                summary.protocols.meso.count += 1;
              }
              if (usd > 0) {
                mesoTotal += usd;
              }
            });
            summary.protocols.meso.value = mesoTotal;
          }

          // Process Earnium rewards (array of pools from API)
          const earniumRewards = Array.isArray(state.rewards.earnium) ? state.rewards.earnium : [];
          console.log('[WalletStore] Processing Earnium rewards:', {
            count: earniumRewards.length,
            sample: earniumRewards.slice(0, 2)
          });

          // Get Earnium token prices directly from Panora API
          let earniumPrices: Record<string, string> = {};
          if (earniumRewards.length > 0) {
            earniumPrices = await getEarniumTokenPrices(earniumRewards);
          }

          earniumRewards.forEach((pool: any) => {
            if (pool.rewards && Array.isArray(pool.rewards)) {
              console.log(`[WalletStore] Processing Earnium pool ${pool.pool}:`, {
                poolId: pool.pool,
                rewardsCount: pool.rewards.length,
                staked: pool.staked
              });

              pool.rewards.forEach((reward: any) => {
                if (reward.amount && reward.amount > 0) {
                  console.log(`[WalletStore] Processing Earnium reward:`, {
                    token: reward.symbol,
                    tokenKey: reward.tokenKey,
                    amount: reward.amount,
                    decimals: reward.decimals
                  });

                  // Clean the token address
                  let cleanAddress = reward.tokenKey;
                  if (cleanAddress.startsWith('@')) {
                    cleanAddress = cleanAddress.slice(1);
                  }
                  if (!cleanAddress.startsWith('0x')) {
                    cleanAddress = `0x${cleanAddress}`;
                  }

                  // Check direct prices first, then fallback to store prices
                  let price = '0';
                  if (earniumPrices[cleanAddress]) {
                    price = earniumPrices[cleanAddress];
                    console.log(`[WalletStore] Found direct Earnium price: ${price}`);
                  } else if (state.prices[cleanAddress]) {
                    price = state.prices[cleanAddress];
                    console.log(`[WalletStore] Found store price: ${price}`);
                  } else {
                    console.log(`[WalletStore] No price found for address: ${cleanAddress}`);
                  }

                  if (parseFloat(price) > 0) {
                    const value = reward.amount * parseFloat(price);
                    summary.protocols.earnium.value += value;
                    summary.protocols.earnium.count++;
                    console.log(`[WalletStore] Earnium reward processed:`, {
                      token: reward.symbol,
                      amount: reward.amount,
                      price: price,
                      value: value,
                      pool: pool.pool
                    });
                  } else {
                    console.log(`[WalletStore] Earnium reward skipped (no price):`, {
                      token: reward.symbol,
                      amount: reward.amount,
                      address: cleanAddress,
                      reason: 'Price is 0 or not found'
                    });
                  }
                }
              });
            }
          });

          // Process Moar rewards
          const moarRewards = Array.isArray(state.rewards.moar) ? state.rewards.moar : [];
          console.log('[WalletStore] Processing Moar rewards:', {
            count: moarRewards.length,
            sample: moarRewards.slice(0, 2)
          });

          moarRewards.forEach((reward: any) => {
            if (reward.usdValue && reward.usdValue > 0) {
              console.log(`[WalletStore] Processing Moar reward:`, {
                symbol: reward.symbol,
                amount: reward.amount,
                usdValue: reward.usdValue,
                farming_identifier: reward.farming_identifier,
                reward_id: reward.reward_id
              });

              summary.protocols.moar.value += reward.usdValue;
              summary.protocols.moar.count += 1;
            }
          });
          
          // Calculate total value
          summary.totalValue = Object.values(summary.protocols).reduce((sum: number, protocol: any) => sum + protocol.value, 0);
          
          console.log('[WalletStore] Final summary:', summary);
          
          return summary;
        },
        
        getTotalValue: () => {
          const state = get();
          const parseNum = (v: any) => {
            const n = parseFloat(v);
            return Number.isFinite(n) ? n : 0;
          };

          const pickValue = (obj: any, keys: string[]) => {
            for (const k of keys) {
              if (obj && obj[k] != null) {
                const n = parseNum(obj[k]);
                if (n) return n;
              }
            }
            return 0;
          };

          let total = 0;

          // 1) Суммируем value по позициям
          const positionValueKeys = [
            'value',
            'totalValue',
            'total_value',
            'totalValueUsd',
            'total_value_usd',
            'usdValue',
            'amountUSD',
            'amountUsd',
            'amount_usd',
            'positionValueUSD',
            'position_value_usd',
            'position_value',
            'total_position_value',
            'total_position_value_usd',
            'netValue',
            'net_value',
            'netValueUsd',
            'net_value_usd',
            'tvlUSD',
            'tvl_usd',
            'liquidityUsd',
            'liquidity_usd',
          ];

          Object.values(state.positions).forEach((protocolPositions: any[]) => {
            protocolPositions.forEach((position: any) => {
              const baseVal = pickValue(position || {}, positionValueKeys);
              total += baseVal;

              // deposits / supplies nested
              if (Array.isArray(position?.deposits)) {
                position.deposits.forEach((d: any) => {
                  total += pickValue(d || {}, positionValueKeys);
                });
              }
              if (Array.isArray(position?.supplies)) {
                position.supplies.forEach((d: any) => {
                  total += pickValue(d || {}, positionValueKeys);
                });
              }

              // Hyperion: учесть незаявленные награды внутри позиций
              const farmRewards = position?.farm?.unclaimed || [];
              farmRewards.forEach((r: any) => {
                total += pickValue(r || {}, ['amountUSD', 'amountUsd', 'usdValue', 'amount_usd', 'usd_value', 'amount']);
              });
              const feeRewards = position?.fees?.unclaimed || [];
              feeRewards.forEach((r: any) => {
                total += pickValue(r || {}, ['amountUSD', 'amountUsd', 'usdValue', 'amount_usd', 'usd_value', 'amount']);
              });
            });
          });

          // 2) Суммируем rewards стора (если их нет в позициях)
          Object.values(state.rewards).forEach((protocolRewards: any) => {
            if (Array.isArray(protocolRewards)) {
              protocolRewards.forEach((r: any) => {
                total += pickValue(r || {}, ['amountUSD', 'amountUsd', 'usdValue', 'amount_usd', 'usd_value', 'amount']);
              });
            } else if (protocolRewards && typeof protocolRewards === 'object') {
              // Auro может храниться как объект {positionId: {amountUSD}}
              Object.values(protocolRewards as any).forEach((r: any) => {
                total += pickValue(r || {}, ['amountUSD', 'amountUsd', 'usdValue', 'amount_usd', 'usd_value', 'amount']);
              });
            }
          });

          return total;
        },
        
        setRewards: (protocol: string, rewards: any[]) => {
          set((state) => ({
            rewards: {
              ...state.rewards,
              [protocol]: rewards
            }
          }));
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