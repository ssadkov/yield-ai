import { useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

export interface TransactionPayload {
  function: string;
  typeArguments: string[];
  functionArguments: any[];
}

export interface TransactionOptions {
  maxGasAmount?: number;
}

export interface TransactionRequest {
  data: TransactionPayload;
  options?: TransactionOptions;
}

export function useTransactionSubmitter() {
  const wallet = useWallet();
  
  const submitTransaction = useCallback(async (request: TransactionRequest) => {
    if (!wallet.connected || !wallet.signAndSubmitTransaction) {
      throw new Error('Wallet not connected');
    }
    
    console.log('Submitting transaction via unified submitter:', request);
    
    // Use wallet.signAndSubmitTransaction with withFeePayer: true for gas station support
    console.log('Using wallet.signAndSubmitTransaction with withFeePayer: true');
    
    const response = await wallet.signAndSubmitTransaction({
      data: {
        function: request.data.function as `${string}::${string}::${string}`,
        typeArguments: request.data.typeArguments,
        functionArguments: request.data.functionArguments
      },
      options: {
        maxGasAmount: Math.min(request.options?.maxGasAmount || 20000, 20000), // Gas station limit is 20000
      },
      withFeePayer: true, // Enable gas station
    });
    
    console.log('Transaction submitted successfully:', response);
    return response;
  }, [wallet]);
  
  return { 
    submitTransaction,
    isConnected: wallet.connected,
    hasSignAndSubmitTransaction: !!wallet.signAndSubmitTransaction
  };
} 