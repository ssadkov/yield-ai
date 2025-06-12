export interface Token {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
  verified: boolean;
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