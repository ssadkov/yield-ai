export type ProtocolKey = "echelon" | "joule" | "aries" | "hyperion" | "meso" | "auro" | "amnis" | "kofi" | "tapp";

export interface DepositParams {
  protocol: ProtocolKey;
  token: string;
  amount: bigint;
} 