export type ProtocolKey = "echelon" | "joule" | "aries" | "hyperion" | "meso" | "auro" | "amnis";

export interface DepositParams {
  protocol: ProtocolKey;
  token: string;
  amount: bigint;
} 