/**
 * TanStack Query configuration constants
 * Defines caching strategies, retry logic, and default options
 */

// Cache time (gcTime) - how long unused data stays in cache
export const CACHE_TIME = {
  SHORT: 30 * 1000, // 30 seconds
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 10 * 60 * 1000, // 10 minutes
  VERY_LONG: 30 * 60 * 1000, // 30 minutes
} as const;

// Stale time - how long data is considered fresh
export const STALE_TIME = {
  BALANCE: 60 * 1000, // 1 minute
  POSITIONS: 5 * 60 * 1000, // 5 minutes
  POOLS: 5 * 60 * 1000, // 5 minutes
  PRICES: 60 * 1000, // 1 minute
  TRANSACTIONS: 2 * 60 * 1000, // 2 minutes
  TOKEN_INFO: 10 * 60 * 1000, // 10 minutes
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  DEFAULT: 3,
  NETWORK_ERROR: 2,
  NO_RETRY: 0,
} as const;

// Retry delay function
export const getRetryDelay = (attemptIndex: number): number => {
  return Math.min(1000 * 2 ** attemptIndex, 30000); // Exponential backoff, max 30s
};

// Default query options
export const DEFAULT_QUERY_OPTIONS = {
  staleTime: STALE_TIME.POSITIONS,
  gcTime: CACHE_TIME.MEDIUM,
  retry: RETRY_CONFIG.DEFAULT,
  retryDelay: getRetryDelay,
  refetchOnWindowFocus: false,
  refetchOnMount: true,
  refetchOnReconnect: true,
} as const;
