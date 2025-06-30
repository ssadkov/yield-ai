export interface MesoTokenMapping {
  inner: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
}

export const MESO_TOKEN_MAPPINGS: MesoTokenMapping[] = [
  {
    inner: "0x2411630a1b063991f3c34a4e78de6c15ea1d5ecc94f97b157f80cd9d1a3114f4",
    tokenAddress: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt",
    symbol: "stAPT",
    name: "Staked Aptos Coin",
    decimals: 8,
    logoUrl: "https://assets.panora.exchange/tokens/aptos/stAptAmnis.svg"
  },
  {
    inner: "0x413665cf85d7e6c2152d27bc2745fae5e5e2a8587c8fd1331937628b080caf7b",
    tokenAddress: "0x1::aptos_coin::AptosCoin",
    symbol: "APT",
    name: "Aptos Coin",
    decimals: 8,
    logoUrl: "https://assets.panora.exchange/tokens/aptos/APT.svg"
  },
  {
    inner: "0x8e9d0ef48dd4ec20c64082c3bb50cdc30fc9ae1b286fefb1cb4e67fca68ae0b7",
    tokenAddress: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
    symbol: "USDC",
    name: "USDC",
    decimals: 6,
    logoUrl: "https://assets.panora.exchange/tokens/aptos/USDC.svg"
  }
];

export function getMesoTokenByInner(inner: string): MesoTokenMapping | undefined {
  return MESO_TOKEN_MAPPINGS.find(token => token.inner === inner);
}

export function getMesoTokenByAddress(tokenAddress: string): MesoTokenMapping | undefined {
  return MESO_TOKEN_MAPPINGS.find(token => token.tokenAddress === tokenAddress);
}

export function getMesoTokenSymbol(inner: string): string {
  const token = getMesoTokenByInner(inner);
  return token?.symbol || "Unknown";
}

export function getMesoTokenName(inner: string): string {
  const token = getMesoTokenByInner(inner);
  return token?.name || "Unknown Token";
} 