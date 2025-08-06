import { useCallback, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { protocols } from '../protocols/protocolsRegistry';
import { ProtocolKey } from '../transactions/types';

export function useClaimRewards() {
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const claimRewards = useCallback(
    async (protocolKey: ProtocolKey, positionIds: string[], tokenTypes: string[]) => {
      try {
        setIsLoading(true);
        const protocolInstance = protocols[protocolKey];
        if (!protocolInstance) throw new Error(`Protocol ${protocolKey} not found`);
        if (typeof protocolInstance.buildClaimRewards !== 'function') throw new Error(`Protocol ${protocolKey} does not have buildClaimRewards method`);
        
        // For Echelon, pass user address
        const userAddress = protocolKey === 'echelon' && wallet.account?.address ? wallet.account.address.toString() : undefined;
        const payload = await protocolInstance.buildClaimRewards(positionIds, tokenTypes, userAddress);
        if (!payload || typeof payload !== 'object') throw new Error('Invalid payload generated');
        if (!wallet.connected || !wallet.signAndSubmitTransaction) throw new Error('Wallet not connected');
        const response = await wallet.signAndSubmitTransaction({
          data: {
            function: payload.function as `${string}::${string}::${string}`,
            typeArguments: payload.type_arguments,
            functionArguments: payload.arguments
          },
          options: { maxGasAmount: 20000 }, // Network limit is 20000
        });
        if (response.hash) {
          const maxAttempts = 10;
          const delay = 2000;
          for (let i = 0; i < maxAttempts; i++) {
            try {
              const txResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${response.hash}`);
              const txData = await txResponse.json();
              if (txData.success && txData.vm_status === 'Executed successfully') {
                const action = (
                  <ToastAction altText="View in Explorer" onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${response.hash}?network=mainnet`, '_blank')}>
                    View in Explorer
                  </ToastAction>
                );
                toast({
                  title: 'Claim rewards successful!',
                  description: `Transaction hash: ${response.hash.slice(0, 6)}...${response.hash.slice(-4)}`,
                  action,
                });
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('refreshPositions', { detail: { protocol: protocolKey } }));
                }, 2000);
                return response;
              } else if (txData.vm_status) {
                throw new Error(`Transaction failed: ${txData.vm_status}`);
              }
            } catch (error) {}
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          throw new Error('Transaction status check timeout');
        }
        return response;
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to claim rewards',
          variant: 'destructive',
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet, toast]
  );

  return {
    claimRewards,
    isLoading,
  };
} 