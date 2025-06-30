export type ProtocolKey = "echelon" | "joule" | "aries" | "hyperion" | "meso";

export interface DepositParams {
  protocol: ProtocolKey;
  token: string;
  amount: bigint;
} 