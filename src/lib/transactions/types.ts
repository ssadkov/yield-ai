export type ProtocolKey = "echelon" | "joule" | "aries" | "hyperion" | "meso" | "auro" | "amnis" | "kofi" | "tapp" | "earnium" | "aave" | "moar" | "thala";

export interface DepositParams {
  protocol: ProtocolKey;
  token: string;
  amount: bigint;
}

export type ActivityType = 
  | "ACTIVITY_COIN_SWAP"
  | "ACTIVITY_DEPOSIT_MARKET"
  | "ACTIVITY_WITHDRAW_MARKET"
  | "ACTIVITY_COIN_ADD_LIQUID"
  | "ACTIVITY_COIN_REMOVE_LIQUID";

export interface AmountInfo {
  token1?: string;
  amount1?: number;
  token2?: string;
  amount2?: number;
  routers?: string[];
  token1_decimals?: number;
  token2_decimals?: number;
  coin_1_isFungible?: boolean;
  coin_2_isFungible?: boolean;
}

export interface Transaction {
  block_id: string;
  tx_version: string;
  trans_id: string;
  block_time: number;
  activity_type: ActivityType;
  from_address: string;
  sources: string[];
  platform: string[];
  amount_info?: AmountInfo;
  value?: number;
}

export interface TransactionMetadata {
  accounts: Record<string, {
    label?: {
      address: string;
      label: string;
      type: string;
      logo?: string;
    };
    data?: any;
  }>;
  coins: Record<string, {
    data: {
      coin_id: string;
      name: string;
      symbol: string;
      decimals: number;
      current_price?: number;
      logo_url?: string;
    };
  }>;
  tokens: Record<string, any>;
  tokenv2s: Record<string, any>;
  collections: Record<string, any>;
  collectionv2s: Record<string, any>;
  fungible_assets: Record<string, {
    data: {
      coin_id: string;
      name: string;
      symbol: string;
      decimals: number;
      current_price?: number;
      logo_url?: string;
      address?: string;
    };
  }>;
  modules: Record<string, any>;
}

export interface TransactionsResponse {
  success: boolean;
  data: Transaction[];
  metadata: TransactionMetadata;
} 