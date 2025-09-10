import { useCallback, useState } from 'react';
import { executeDeposit } from '../transactions/DepositTransaction';
import { ProtocolKey } from '../transactions/types';
import { useToast } from '@/components/ui/use-toast';
import { showTransactionSuccessToast } from '@/components/ui/transaction-toast';
import { ToastAction } from '@/components/ui/toast';
import { protocols } from '../protocols/protocolsRegistry';
import { useTransactionSubmitter } from './useTransactionSubmitter';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

export function useDeposit() {
  const { submitTransaction, isConnected, hasSignAndSubmitTransaction } = useTransactionSubmitter();
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const deposit = useCallback(async (
    protocolKey: ProtocolKey,
    token: string,
    amount: bigint
  ) => {
    try {
      console.log('Starting deposit:', { protocolKey, token, amount });
      setIsLoading(true);

      const protocolInstance = protocols[protocolKey];
      console.log('Protocol instance:', protocolInstance);
      console.log('Protocol instance type:', typeof protocolInstance);

      if (!protocolInstance) {
        throw new Error(`Protocol ${protocolKey} not found`);
      }

      console.log('Protocol instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(protocolInstance)));

      if (typeof protocolInstance.buildDeposit !== 'function') {
        throw new Error(`Protocol ${protocolKey} does not have buildDeposit method`);
      }

      const payload = await executeDeposit(protocolInstance, token, amount, wallet);
      console.log('Generated payload:', payload);

      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid payload generated');
      }

      console.log('Submitting transaction with payload:', payload);
      console.log('Wallet state:', { 
        hasSignAndSubmitTransaction,
        isConnected
      });

      if (!isConnected || !hasSignAndSubmitTransaction) {
        throw new Error('Wallet not connected');
      }

      console.log('Transaction arguments:', {
        function: payload.function,
        typeArguments: payload.type_arguments,
        functionArguments: payload.arguments,
        rawArguments: payload.arguments.map(arg => ({
          value: arg,
          type: typeof arg,
          length: arg.length
        }))
      });

      // Determine appropriate gas limit based on token type
      let maxGasAmount = 20000; // Default for most tokens
      
      // For APT transactions, use higher gas limit since gas station is working
      if (token === '0x1::aptos_coin::AptosCoin' || token === '0xa') {
        maxGasAmount = 2000; // Increased gas limit for APT transactions with gas station
      }

      const response = await submitTransaction({
        data: {
          function: payload.function,
          typeArguments: payload.type_arguments,
          functionArguments: payload.arguments
        },
        options: {
          maxGasAmount: maxGasAmount,
        },
      });
      console.log('Transaction response:', response);

      if (response.hash) {
        console.log('Checking transaction status for hash:', response.hash);
        const maxAttempts = 10;
        const delay = 2000;
        
        for (let i = 0; i < maxAttempts; i++) {
          console.log(`Checking transaction status attempt ${i + 1}/${maxAttempts}`);
          try {
            const txResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${response.hash}`);
            const txData = await txResponse.json();
            console.log('Transaction success:', txData.success);
            console.log('Transaction vm_status:', txData.vm_status);
            
            if (txData.success && txData.vm_status === "Executed successfully") {
              console.log('Transaction confirmed successfully, showing toast...');
              showTransactionSuccessToast({ hash: response.hash });
              console.log('Toast should be shown now');
              return response;
            } else if (txData.vm_status) {
              console.error('Transaction failed with status:', txData.vm_status);
              throw new Error(`Transaction failed: ${txData.vm_status}`);
            }
          } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
          }
          
          console.log(`Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        console.error('Transaction status check timeout');
        throw new Error('Transaction status check timeout');
      }

      return response;
    } catch (error) {
      console.error('Deposit error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to deposit',
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [submitTransaction, isConnected, hasSignAndSubmitTransaction, wallet, toast]);

  return {
    deposit,
    isLoading,
  };
} 