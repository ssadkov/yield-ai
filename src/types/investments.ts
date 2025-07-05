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
}

export interface InvestmentsResponse {
  protocols: Record<string, number>;
  data: InvestmentData[];
}

export type InvestmentAction = 'Invest' | 'Borrow' | 'Stake'; 