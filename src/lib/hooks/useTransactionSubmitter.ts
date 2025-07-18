import { useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { AptBalanceService } from '../services/aptBalance';
import { GasStationService } from '../services/gasStation';

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
    
    // Check APT balance to decide whether to use gas station
    const aptBalance = await AptBalanceService.getAptBalance(wallet.account?.address?.toString() || '');
    console.log('APT balance:', aptBalance);
    
    if (aptBalance > 0) {
      // User has APT, use regular transaction
      console.log('Using regular transaction (APT balance > 0)');
      const response = await wallet.signAndSubmitTransaction({
        data: {
          function: request.data.function as `${string}::${string}::${string}`,
          typeArguments: request.data.typeArguments,
          functionArguments: request.data.functionArguments
        },
        options: {
          maxGasAmount: Math.min(request.options?.maxGasAmount || 20000, 20000), // Network limit is 20000
        },
      });
      
      console.log('Regular transaction submitted successfully:', response);
      return response;
    } else {
      // User has no APT, use gas station with withFeePayer
      console.log('Using gas station with withFeePayer (APT balance = 0)');
      
      const gasStationService = GasStationService.getInstance();
      
      if (!gasStationService.isAvailable()) {
        throw new Error('Gas station is not available. Please ensure you have APT for gas fees or configure gas station.');
      }
      
      // Use wallet.signAndSubmitTransaction with withFeePayer: true
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
      
      console.log('Gas station transaction submitted successfully:', response);
      return response;
    }
  }, [wallet]);
  
  return { 
    submitTransaction,
    isConnected: wallet.connected,
    hasSignAndSubmitTransaction: !!wallet.signAndSubmitTransaction
  };
} 