// Bridge service - to be implemented with Wormhole Connect

export interface BridgeQuote {
  amount: string;
  estimatedTime: string;
  fees: {
    source: string;
    destination?: string;
  };
}

export interface BridgeStatus {
  status: "pending" | "completed" | "failed";
  sourceTxHash?: string;
  destinationTxHash?: string;
  messageId?: string;
  error?: string;
}

export interface BridgeRequest {
  amount: string;
  fromAddress: string;
  toAddress: string;
}
