export type ProtocolKey = "echelon" | "joule" | "aries" | "hyperion";

export interface DepositParams {
  protocol: ProtocolKey;
  token: string;
  amount: bigint;
} 