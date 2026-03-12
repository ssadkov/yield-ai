/**
 * Type-safe query keys factory for TanStack Query
 * 
 * Provides centralized, type-safe query keys for all API endpoints.
 * Query keys are structured as arrays to work with TanStack Query's key matching.
 * 
 * @example
 * ```ts
 * // Simple query key
 * queryKeys.aptos.balance('0x123...')
 * // Returns: ['aptos', 'balance', '0x123...']
 * 
 * // Query key with params
 * queryKeys.transactions.all({ address: '0x123...', protocol: 'echelon' })
 * // Returns: ['transactions', 'all', { address: '0x123...', protocol: 'echelon' }]
 * ```
 */

import { ProtocolKey, ActivityType } from '@/lib/transactions/types';

/**
 * Parameters for transactions query
 */
export interface TransactionsQueryParams {
  address: string;
  protocol?: ProtocolKey;
  activityType?: ActivityType;
  page?: number;
}

/**
 * Parameters for Panora prices query
 */
export interface PanoraPricesParams {
  chainId: number;
  addresses?: string[];
}

/**
 * Parameters for Panora swap quote query
 */
export interface PanoraSwapQuoteParams {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageTolerance?: number;
}

/**
 * Parameters for token info query
 */
export interface TokenInfoParams {
  chainId?: number;
  tokenAddress?: string;
}

/**
 * Query keys factory
 */
export const queryKeys = {
  /**
   * Aptos blockchain queries
   */
  aptos: {
    /**
     * Get wallet balance for an address
     */
    balance: (address: string) => ['aptos', 'balance', address] as const,

    /**
     * Get complete portfolio data for an address
     */
    portfolio: (address: string) => ['aptos', 'portfolio', address] as const,

    /**
     * Get transactions for an address with optional filters
     */
    transactions: (params: TransactionsQueryParams) =>
      ['aptos', 'transactions', params] as const,

    /**
     * Get account resources
     */
    resources: (address: string) => ['aptos', 'resources', address] as const,

    /**
     * Get detailed wallet balance
     */
    walletBalance: (address: string) =>
      ['aptos', 'walletBalance', address] as const,

    /**
     * Get wallet balance with USD prices
     */
    walletBalanceWithPrices: (address: string) =>
      ['aptos', 'walletBalanceWithPrices', address] as const,

    /**
     * Get investment pools/opportunities
     */
    pools: () => ['aptos', 'pools'] as const,
  },

  /**
   * Protocol-specific queries
   */
  protocols: {
    /**
     * Get pools for a specific protocol
     */
    pools: (protocol: ProtocolKey) =>
      ['protocols', protocol, 'pools'] as const,

    /**
     * Get user positions for a specific protocol
     */
    userPositions: (protocol: ProtocolKey, address: string) =>
      ['protocols', protocol, 'userPositions', address] as const,

    /**
     * Hyperion protocol specific queries
     */
    hyperion: {
      pools: () => ['protocols', 'hyperion', 'pools'] as const,
      userPositions: (address: string) =>
        ['protocols', 'hyperion', 'userPositions', address] as const,
      vaultData: (address: string) =>
        ['protocols', 'hyperion', 'vaultData', address] as const,
    },

    /**
     * Auro protocol specific queries
     */
    auro: {
      pools: () => ['protocols', 'auro', 'pools'] as const,
      userPositions: (address: string) =>
        ['protocols', 'auro', 'userPositions', address] as const,
    },

    /**
     * Amnis protocol specific queries
     */
    amnis: {
      pools: () => ['protocols', 'amnis', 'pools'] as const,
      userPositions: (address: string) =>
        ['protocols', 'amnis', 'userPositions', address] as const,
    },

    /**
     * Decibel protocol specific queries
     */
    decibel: {
      userPositions: (address: string) =>
        ['protocols', 'decibel', 'userPositions', address] as const,
    },

    /**
     * Earnium protocol specific queries
     */
    earnium: {
      pools: () => ['protocols', 'earnium', 'pools'] as const,
      userPositions: (address: string) =>
        ['protocols', 'earnium', 'userPositions', address] as const,
    },

    /**
     * Moar protocol specific queries
     */
    moar: {
      pools: () => ['protocols', 'moar', 'pools'] as const,
      userPositions: (address: string) =>
        ['protocols', 'moar', 'userPositions', address] as const,
      rewards: (address: string) =>
        ['protocols', 'moar', 'rewards', address] as const,
    },

    /**
     * Tapp protocol specific queries
     */
    tapp: {
      pools: () => ['protocols', 'tapp', 'pools'] as const,
      userPositions: (address: string) =>
        ['protocols', 'tapp', 'userPositions', address] as const,
    },

    /**
     * Thala protocol specific queries
     */
    thala: {
      pools: () => ['protocols', 'thala', 'pools'] as const,
      userPositions: (address: string) =>
        ['protocols', 'thala', 'userPositions', address] as const,
    },

    /**
     * Kofi protocol specific queries
     */
    kofi: {
      pools: () => ['protocols', 'kofi', 'pools'] as const,
    },

    /**
     * Aave protocol specific queries
     */
    aave: {
      pools: () => ['protocols', 'aave', 'pools'] as const,
      userPositions: (address: string) =>
        ['protocols', 'aave', 'userPositions', address] as const,
    },

    /**
     * Joule protocol specific queries
     */
    joule: {
      userPositions: (address: string) =>
        ['protocols', 'joule', 'userPositions', address] as const,
    },

    /**
     * Aries protocol specific queries
     */
    aries: {
      userPositions: (address: string) =>
        ['protocols', 'aries', 'userPositions', address] as const,
    },

    /**
     * Meso protocol specific queries
     */
    meso: {
      userPositions: (address: string) =>
        ['protocols', 'meso', 'userPositions', address] as const,
    },

    /**
     * Echo protocol specific queries
     */
    echo: {
      userPositions: (address: string) =>
        ['protocols', 'echo', 'userPositions', address] as const,
    },
  },

  /**
   * Panora API queries
   */
  panora: {
    /**
     * Get token prices
     */
    prices: (params: PanoraPricesParams) =>
      ['panora', 'prices', params] as const,

    /**
     * Get token list
     */
    tokenList: () => ['panora', 'tokenList'] as const,

    /**
     * Get specific token prices
     */
    tokenPrices: (chainId: number, tokenAddress?: string) =>
      ['panora', 'tokenPrices', chainId, tokenAddress] as const,

    /**
     * Get swap quote
     */
    swapQuote: (params: PanoraSwapQuoteParams) =>
      ['panora', 'swapQuote', params] as const,

    /**
     * Execute swap (mutation key)
     */
    executeSwap: () => ['panora', 'executeSwap'] as const,
  },

  /**
   * Solana blockchain queries
   */
  solana: {
    /**
     * Get Solana portfolio for an address
     */
    portfolio: (address: string) =>
      ['solana', 'portfolio', address] as const,
  },

  /**
   * Token information queries
   */
  tokens: {
    /**
     * Get token information
     */
    info: (params?: TokenInfoParams) =>
      ['tokens', 'info', params] as const,
  },

  /**
   * Transaction queries (general)
   */
  transactions: {
    /**
     * Get all transactions with filters
     */
    all: (params: TransactionsQueryParams) =>
      ['transactions', 'all', params] as const,

    /**
     * Get transactions for a specific address
     */
    byAddress: (address: string) =>
      ['transactions', 'byAddress', address] as const,

    /**
     * Get transactions filtered by protocol
     */
    byProtocol: (address: string, protocol: ProtocolKey) =>
      ['transactions', 'byProtocol', address, protocol] as const,

    /**
     * Get transactions filtered by activity type
     */
    byActivityType: (address: string, activityType: ActivityType) =>
      ['transactions', 'byActivityType', address, activityType] as const,
  },
} as const;

/**
 * Helper type to extract query key type
 */
export type QueryKey = ReturnType<
  (typeof queryKeys)[keyof typeof queryKeys][keyof (typeof queryKeys)[keyof typeof queryKeys]]
>;
