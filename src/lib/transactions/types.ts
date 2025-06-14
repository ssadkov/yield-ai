export type ProtocolKey = "echelon" | "joule" | "aries";

export interface DepositParams {
  protocol: ProtocolKey;
  token: string;
  amount: bigint;
} 