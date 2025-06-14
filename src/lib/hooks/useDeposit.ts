import { useCallback, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { executeDeposit } from '../transactions/DepositTransaction';
import { ProtocolKey } from '../transactions/types';
import { toast } from 'sonner';
import { protocols } from '../protocols/protocolsRegistry';

export function useDeposit() {
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);

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
      console.log('Protocol instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(protocolInstance)));

      if (!protocolInstance) {
        throw new Error(`Protocol ${protocolKey} not found`);
      }

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
        hasSignAndSubmitTransaction: !!wallet.signAndSubmitTransaction,
        signAndSubmitTransactionType: typeof wallet.signAndSubmitTransaction,
        isConnected: wallet.connected
      });

      if (!wallet.connected || !wallet.signAndSubmitTransaction) {
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

      const response = await wallet.signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.type_arguments,
          functionArguments: payload.arguments
        },
        options: {
          maxGasAmount: 100000,
        },
      });
      console.log('Transaction response:', response);

      toast.success('Deposit successful');
      return response;
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to deposit');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [wallet]);

  return {
    deposit,
    isLoading,
  };
} 