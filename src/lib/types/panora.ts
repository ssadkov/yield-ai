export interface Token {
  chainId: number;
  panoraId: string;
  tokenAddress: string | null;
  faAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  bridge: string | null;
  panoraSymbol: string;
  usdPrice: string;
  logoUrl: string;
  websiteUrl: string | null;
  panoraUI: boolean;
  panoraTags: string[];
  panoraIndex: number;
  coinGeckoId: string | null;
  coinMarketCapId: number | null;
  isInPanoraTokenList: boolean;
  isBanned: boolean;
}

export interface TokenListResponse {
  tokens: Token[];
  version: {
    major: number;
    minor: number;
    patch: number;
  };
}

export interface TokenListError {
  message: string;
  code: string;
}

export const SUPPORTED_CHAIN_IDS = {
  APTOS: 1,
} as const;

export type SupportedChainId = typeof SUPPORTED_CHAIN_IDS[keyof typeof SUPPORTED_CHAIN_IDS];

export const DEFAULT_CHAIN_ID = SUPPORTED_CHAIN_IDS.APTOS; 