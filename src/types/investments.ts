export interface InvestmentData {
  asset: string;
  provider: string;
  totalAPY: number;
  depositApy: number;
  borrowAPY: number;
  token: string;
  protocol: string;
}

export interface InvestmentsResponse {
  protocols: Record<string, number>;
  data: InvestmentData[];
}

export type InvestmentAction = 'Invest' | 'Borrow' | 'Stake'; 