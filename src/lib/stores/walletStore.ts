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
  getClaimableRewardsSummary: () => ClaimableRewardsSummary;
  
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
            const protocolsToFetch = protocols || ['echelon', 'auro', 'hyperion'];
            const newRewards: ProtocolRewards = { ...state.rewards };
            
            // Fetch rewards for each protocol
            const promises = protocolsToFetch.map(async (protocol) => {
              try {
                if (protocol === 'hyperion') {
                  // Hyperion rewards are embedded in positions data
                  const response = await fetch(`/api/protocols/${protocol}/userPositions?address=${encodeURIComponent(address)}`);
                  
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
                    console.warn(`[WalletStore] Failed to fetch ${protocol} positions:`, response.status);
                    newRewards[protocol] = [];
                  }
                } else {
                  // Standard rewards API for echelon and auro
                  const response = await fetch(`/api/protocols/${protocol}/rewards?address=${encodeURIComponent(address)}`);
                  
                  if (response.ok) {
                    const data = await response.json();
                                         // For Auro, data.data is an object with position addresses as keys
                     // For Echelon, data.data is an array
                     if (protocol === 'auro') {
                       newRewards[protocol] = data.data || {};
                       
                     } else {
                      newRewards[protocol] = data.data || [];
                      console.log(`[WalletStore] ${protocol} rewards fetched:`, newRewards[protocol].length);
                    }
                  } else {
                    console.warn(`[WalletStore] Failed to fetch ${protocol} rewards:`, response.status);
                    newRewards[protocol] = protocol === 'auro' ? {} : [];
                  }
                }
              } catch (error) {
                console.error(`[WalletStore] Error fetching ${protocol} rewards:`, error);
                newRewards[protocol] = [];
              }
            });
            
            await Promise.all(promises);
            
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
               await get().fetchPrices(uniqueTokenAddresses);
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
        
        getClaimableRewardsSummary: () => {
          const state = get();
          const summary: ClaimableRewardsSummary = {
            totalValue: 0,
            protocols: {
              echelon: { value: 0, count: 0 },
              auro: { value: 0, count: 0 },
              hyperion: { value: 0, count: 0 }
            }
          };
          
          // Process Echelon rewards
          const echelonRewards = state.rewards.echelon || [];
          echelonRewards.forEach((reward: any) => {
            if (reward.amount && reward.amount > 0) {
              
              let tokenAddress = null;
              let price = '0';
              
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
                
                                 // Check if we have a price for this address
                 if (state.prices[cleanAddress]) {
                   tokenAddress = cleanAddress;
                   price = state.prices[cleanAddress];
                 }
              }
              
              // If no price found by tokenType, try to find by symbol in token list
              if (!tokenAddress) {
                const tokenSymbol = reward.token;
                const tokenList = require('@/lib/data/tokenList.json');
                const tokenInfo = tokenList.data.data.find((token: any) => 
                  token.symbol.toLowerCase() === tokenSymbol.toLowerCase()
                );
                
                if (tokenInfo) {
                  tokenAddress = tokenInfo.faAddress || tokenInfo.tokenAddress;
                  if (tokenAddress) {
                    // Clean the address
                    if (tokenAddress.startsWith('@')) {
                      tokenAddress = tokenAddress.slice(1);
                    }
                    if (!tokenAddress.startsWith('0x')) {
                      tokenAddress = `0x${tokenAddress}`;
                    }
                                         price = state.prices[tokenAddress] || '0';
                  }
                }
              }
              
                             if (tokenAddress && parseFloat(price) > 0) {
                 const value = reward.amount * parseFloat(price);
                 summary.protocols.echelon.value += value;
                 summary.protocols.echelon.count++;
               }
            }
          });
          
          // Process Auro rewards
          const auroRewards = state.rewards.auro || {};
          
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
                     
                     // Find token by address
                     const tokenInfo = tokenList.data.data.find((token: any) => 
                       (token.tokenAddress === cleanAddress || token.faAddress === cleanAddress)
                     );
                     
                     if (tokenInfo) {
                       const decimals = tokenInfo.decimals || 8;
                       const amount = parseFloat(reward.value) / Math.pow(10, decimals);
                       
                       const price = state.prices[cleanAddress] || '0';
                       if (parseFloat(price) > 0) {
                         const value = amount * parseFloat(price);
                         summary.protocols.auro.value += value;
                         summary.protocols.auro.count++;
                       }
                     }
                   } catch (error) {
                     console.warn('Failed to process Auro collateral reward:', reward.key);
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
                     
                     // Find token by address
                     const tokenInfo = tokenList.data.data.find((token: any) => 
                       (token.tokenAddress === cleanAddress || token.faAddress === cleanAddress)
                     );
                     
                     if (tokenInfo) {
                       const decimals = tokenInfo.decimals || 8;
                       const amount = parseFloat(reward.value) / Math.pow(10, decimals);
                       
                       const price = state.prices[cleanAddress] || '0';
                       if (parseFloat(price) > 0) {
                         const value = amount * parseFloat(price);
                         summary.protocols.auro.value += value;
                         summary.protocols.auro.count++;
                       }
                     }
                   } catch (error) {
                     console.warn('Failed to process Auro borrow reward:', reward.key);
                   }
                 }
                });
              }
            }
          });
          
                  // Process Hyperion rewards (calculate by positions, not individual rewards)
        const hyperionPositions = state.positions.hyperion || [];
        
        if (hyperionPositions.length > 0) {
          // Use positions data if available
          hyperionPositions.forEach((position: any) => {
            const farmRewards = position.farm?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
            const feeRewards = position.fees?.unclaimed?.reduce((sum: number, r: any) => sum + parseFloat(r.amountUSD || "0"), 0) || 0;
            const totalRewards = farmRewards + feeRewards;
            
            if (totalRewards > 0) {
              summary.protocols.hyperion.value += totalRewards;
              summary.protocols.hyperion.count++;
            }
          });
        } else {
          // Fallback to rewards data if positions not available
          const hyperionRewards = state.rewards.hyperion || [];
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
          
                     // Calculate total value
           summary.totalValue = Object.values(summary.protocols).reduce((sum, protocol) => sum + protocol.value, 0);
           

           
           return summary;
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