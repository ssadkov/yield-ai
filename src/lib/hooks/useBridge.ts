// Bridge hook - to be implemented with Wormhole Connect

import { useState } from 'react';

export interface BridgeParams {
  amount: string;
  toAddress?: string;
}

export function useBridge() {
  const [isLoading, setIsLoading] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState(null);

  const bridge = async (params: BridgeParams) => {
    // To be implemented
    console.log('Bridge function - to be implemented', params);
  };

  return {
    bridge,
    isLoading,
    bridgeStatus,
  };
}
