export interface TokenInfo {
  symbol: string;
  name: string;
  logoUrl?: string;
  decimals: number;
}

export interface InvestmentData {
  asset: string;
  provider: string;
  totalAPY: number;
  depositApy: number;
  borrowAPY: number;
  token: string;
  protocol: string;
  // Optional fields for additional data
  dailyVolumeUSD?: number;
  tvlUSD?: number;
  // Token information for DEX pools
  token1Info?: TokenInfo;
  token2Info?: TokenInfo;
  // Additional DEX pool information
  poolType?: string;
  feeTier?: number;
  volume7d?: number;
  // Additional Echelon-specific data
  supplyCap?: number;
  borrowCap?: number;
  supplyRewardsApr?: number;
  borrowRewardsApr?: number;
  marketAddress?: string;
  totalSupply?: number;
  totalBorrow?: number;
  // Staking-specific fields
  stakingApr?: number;
  isStakingPool?: boolean;
  stakingToken?: string;
  underlyingToken?: string;
  // APR breakdown fields for tooltip
  lendingApr?: number;
  stakingAprOnly?: number;
  totalSupplyApr?: number;
  // Moar Market-specific fields
  poolId?: number;
  interestRateComponent?: number;
  farmingAPY?: number;
  utilization?: number;
  totalBorrows?: number;
  totalDeposits?: number;
  // APR breakdown for detailed information
  aprBreakdown?: {
    baseFeeApr?: number;
    incentiveApr?: number;
    totalApr?: number;
    breakdown?: {
      tradingFees?: number;
      rewards?: number;
      subPoolRewards?: number;
    };
    rewardTokens?: Array<{
      tokenAddress: string;
      apr: number;
      amount: number;
      source: string;
    }>;
  };
  // Thala-specific fields
  aprSources?: Array<{
    source: string;
    apr: number;
  }>;
  lptAddress?: string;
  swapFee?: number;
  // Original pool data (for protocol-specific fields)
  originalPool?: any;
  // Decibel vault–specific (from public vaults API)
  decibelAllTimeReturn?: number; // decimal, e.g. 0.1388 → display as 13.88%
  decibelVaultPnl?: number;     // all_time_pnl in USD
}

export interface InvestmentsResponse {
  protocols: Record<string, number>;
  data: InvestmentData[];
}

export type InvestmentAction = 'Invest' | 'Borrow' | 'Stake'; 