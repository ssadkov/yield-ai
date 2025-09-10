import { useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { GasStationService } from '../services/gasStation';
import { AptBalanceService } from '../services/aptBalance';

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
    
    // Check if this is an APT transaction that needs gas station
    const isAptTransaction = request.data.functionArguments && 
      request.data.functionArguments.some((arg: any) => 
        typeof arg === 'string' && (arg === '0x1::aptos_coin::AptosCoin' || arg === '0xa')
      );
    
    if (aptBalance > 0 && !isAptTransaction) {
      // User has APT and it's not an APT transaction, use regular transaction
      console.log('Using regular transaction (APT balance > 0 and not APT transaction)');
      const response = await wallet.signAndSubmitTransaction({
        data: {
          function: request.data.function as `${string}::${string}::${string}`,
          typeArguments: request.data.typeArguments,
          functionArguments: request.data.functionArguments
        },
        options: {
          maxGasAmount: request.options?.maxGasAmount || 20000,
        },
      });
      
      return response;
    } else {
      // User has no APT or it's an APT transaction, use gas station with withFeePayer
      
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
          maxGasAmount: request.options?.maxGasAmount || 20000,
        },
        withFeePayer: true, // Enable gas station
      });
      
      return response;
    }
  }, [wallet]);
  
  return { 
    submitTransaction,
    isConnected: wallet.connected,
    hasSignAndSubmitTransaction: !!wallet.signAndSubmitTransaction
  };
} 