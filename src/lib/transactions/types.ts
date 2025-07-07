export type ProtocolKey = "echelon" | "joule" | "aries" | "hyperion" | "meso" | "auro";

export interface DepositParams {
  protocol: ProtocolKey;
  token: string;
  amount: bigint;
} 