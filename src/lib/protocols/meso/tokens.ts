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
  },
  {
    inner: "0x1dd5533671217066156a8c47191f05df47ac6b5c3ad490aaf6a03135261c1784",
    tokenAddress: "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoUrl: "https://assets.panora.exchange/tokens/aptos/USDT.svg"
  },
  {
    inner: "0x57fbf2661b0ce2994e848f01002dbd2f74a29815ecc449921f9533437b37e7d9",
    tokenAddress: "0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451",
    symbol: "AMI",
    name: "AMNIS",
    decimals: 8,
    logoUrl: "https://assets.panora.exchange/tokens/aptos/AMI.png"
  },
  {
    inner: "0x2bf74764ac1a42cc713f205dce6f64ea0cecbdc8e83a3eb67a8456e07da27996",
    tokenAddress: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt",
    symbol: "amAPT",
    name: "Amnis Aptos",
    decimals: 8,
    logoUrl: ""
  },
  {
    inner: "0x6c4891c7a18daf4ce8809e2b253a055b565bef53f53110e1c47b12db3e25ae9d",
    tokenAddress: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WBTC",
    symbol: "WBTC",
    name: "Wrapped BTC",
    decimals: 8,
    logoUrl: "https://assets.panora.exchange/tokens/aptos/xBTC.png"
  },
  {
    inner: "0xd9537e122a689de0ff6ed6179ad1858b27828b7436109e7b2f1a4e77daac0d74",
    tokenAddress: "0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T",
    symbol: "T",
    name: "T",
    decimals: 8,
    logoUrl: ""
  },
  {
    inner: "0x612f72aa866d550ec71513b78a4a33f3a3a5807b40adec328b29fae9dcdf3683",
    tokenAddress: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoUrl: "https://assets.panora.exchange/tokens/aptos/USDT.svg"
  },
  {
    inner: "0x198d84431825039d1af43ca4c6cedccf9a343d46de51a05571b897b3c6313b9e",
    tokenAddress: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 8,
    logoUrl: "https://assets.panora.exchange/tokens/aptos/WETH.svg"
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