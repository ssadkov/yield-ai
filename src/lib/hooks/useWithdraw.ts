import { useCallback, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { protocols } from '../protocols/protocolsRegistry';
import { ProtocolKey } from '../transactions/types';

export function useWithdraw() {
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const withdraw = useCallback(async (
    protocolKey: ProtocolKey,
    marketAddress: string,
    amount: bigint,
    token: string
  ) => {
    try {
      console.log('Starting withdraw:', { protocolKey, marketAddress, amount, token });
      setIsLoading(true);

      const protocolInstance = protocols[protocolKey];
      console.log('Protocol instance:', protocolInstance);

      if (!protocolInstance) {
        throw new Error(`Protocol ${protocolKey} not found`);
      }

      if (typeof protocolInstance.buildWithdraw !== 'function') {
        throw new Error(`Protocol ${protocolKey} does not have buildWithdraw method`);
      }

      const payload = await protocolInstance.buildWithdraw(marketAddress, amount, token);
      console.log('Generated withdraw payload:', payload);

      // Для AAVE нужно заменить placeholder адрес пользователя на реальный
      if (protocolKey === 'aave' && payload.arguments && payload.arguments.length >= 3) {
        const userAddress = wallet.account?.address?.toString();
        if (userAddress) {
          // Клонируем payload и заменяем placeholder адрес пользователя
          const modifiedPayload = {
            ...payload,
            arguments: [...payload.arguments]
          };
          modifiedPayload.arguments[2] = userAddress; // Третий аргумент - адрес пользователя
          console.log('Modified AAVE withdraw payload:', modifiedPayload);
          
          // Используем модифицированный payload
          const response = await wallet.signAndSubmitTransaction({
            data: {
              function: modifiedPayload.function as `${string}::${string}::${string}`,
              typeArguments: modifiedPayload.type_arguments,
              functionArguments: modifiedPayload.arguments
            },
            options: {
              maxGasAmount: 20000, // Network limit is 20000
            },
          });
          console.log('Withdraw transaction response:', response);
          
          if (response.hash) {
            // ... existing code for transaction status check ...
            console.log('Checking transaction status for hash:', response.hash);
            const maxAttempts = 10;
            const delay = 2000;
            
            for (let i = 0; i < maxAttempts; i++) {
              console.log(`Checking transaction status attempt ${i + 1}/${maxAttempts}`);
              try {
                const txResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${response.hash}`);
                const txData = await txResponse.json();
                console.log('Transaction status response:', txData);
                
                if (txData.success && txData.vm_status === "Executed successfully") {
                  console.log('Withdraw transaction confirmed successfully');
                  toast({
                    title: "Withdraw successful!",
                    description: `Transaction hash: ${response.hash.slice(0, 6)}...${response.hash.slice(-4)}`,
                  });
                  
                  // Обновляем позиции после успешного withdraw
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('refreshPositions', { 
                      detail: { protocol: protocolKey }
                    }));
                  }, 2000);
                  
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
        }
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid payload generated');
      }

      console.log('Submitting withdraw transaction with payload:', payload);

      if (!wallet.connected || !wallet.signAndSubmitTransaction) {
        throw new Error('Wallet not connected');
      }

      const response = await wallet.signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.type_arguments,
          functionArguments: payload.arguments
        },
        options: {
          maxGasAmount: 20000, // Network limit is 20000
        },
      });
      console.log('Withdraw transaction response:', response);

      if (response.hash) {
        console.log('Checking transaction status for hash:', response.hash);
        const maxAttempts = 10;
        const delay = 2000;
        
        for (let i = 0; i < maxAttempts; i++) {
          console.log(`Checking transaction status attempt ${i + 1}/${maxAttempts}`);
          try {
            const txResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${response.hash}`);
            const txData = await txResponse.json();
            console.log('Transaction status response:', txData);
            
            if (txData.success && txData.vm_status === "Executed successfully") {
              console.log('Withdraw transaction confirmed successfully');
              toast({
                title: "Withdraw successful!",
                description: `Transaction hash: ${response.hash.slice(0, 6)}...${response.hash.slice(-4)}`,
              });
              
              // Обновляем позиции после успешного withdraw
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('refreshPositions', { 
                  detail: { protocol: protocolKey }
                }));
              }, 2000);
              
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
      console.error('Withdraw error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to withdraw',
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, toast]);

  return {
    withdraw,
    isLoading,
  };
} 