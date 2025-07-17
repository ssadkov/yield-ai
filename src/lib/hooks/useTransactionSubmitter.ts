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
    
    const response = await wallet.signAndSubmitTransaction({
      data: {
        function: request.data.function as `${string}::${string}::${string}`,
        typeArguments: request.data.typeArguments,
        functionArguments: request.data.functionArguments
      },
      options: {
        maxGasAmount: request.options?.maxGasAmount || 100000,
      },
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