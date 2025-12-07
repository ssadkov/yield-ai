import { useCallback, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useToast } from '@/components/ui/use-toast';
import { WormholeBridgeService, BridgeRequest, BridgeStatus } from '@/lib/services/wormhole/bridge';
import { getSolanaWalletAddress } from '@/lib/wallet/getSolanaWalletAddress';
import { getSolanaPublicKey } from '@/lib/wallet/getSolanaWalletSigner';

export interface BridgeParams {
  amount: string; // Amount in USDC (with decimals, e.g., "1000000" for 1 USDC)
  toAddress?: string; // Optional Aptos address (will derive if not provided)
}

export function useBridge() {
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const { toast } = useToast();

  const bridge = useCallback(async (params: BridgeParams) => {
    try {
      setIsLoading(true);
      setBridgeStatus(null);

      // Check if wallet is connected
      if (!wallet.connected || !wallet.wallet) {
        throw new Error('Wallet not connected');
      }

      // Get Solana address
      const solanaAddress = getSolanaWalletAddress(wallet.wallet);
      if (!solanaAddress) {
        throw new Error('Solana wallet not available. Please connect a cross-chain wallet.');
      }

      // Get or derive Aptos address
      let aptosAddress = params.toAddress;
      if (!aptosAddress) {
        // Use connected Aptos address
        if (!wallet.account?.address) {
          throw new Error('Aptos address not available');
        }
        aptosAddress = wallet.account.address.toString();
      }

      // Initialize bridge service
      const bridgeService = WormholeBridgeService.getInstance();

      // Create bridge request
      const request: BridgeRequest = {
        amount: params.amount,
        fromAddress: solanaAddress,
        toAddress: aptosAddress,
        wallet: wallet.wallet,
      };

      // Initiate bridge
      const result = await bridgeService.initiateBridge(request);

      if (!result.success) {
        throw new Error(result.error || 'Failed to initiate bridge transfer');
      }

      // Set initial status
      setBridgeStatus({
        status: 'pending',
        sourceTxHash: result.txHash,
        messageId: result.messageId,
      });

      // Show success toast
      toast({
        title: 'Bridge Initiated',
        description: `Transfer initiated. Transaction: ${result.txHash?.slice(0, 8)}...`,
      });

      // Start polling for status updates
      if (result.txHash) {
        pollBridgeStatus(result.txHash, result.messageId);
      }

      return result;
    } catch (error: any) {
      console.error('Bridge error:', error);
      setBridgeStatus({
        status: 'failed',
        error: error.message || 'Failed to bridge tokens',
      });
      toast({
        title: 'Bridge Error',
        description: error.message || 'Failed to bridge tokens',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, toast]);

  const pollBridgeStatus = useCallback(async (txHash: string, messageId?: string) => {
    const bridgeService = WormholeBridgeService.getInstance();
    const maxAttempts = 30; // Poll for up to 5 minutes (10s intervals)
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await bridgeService.checkBridgeStatus(txHash, messageId);
        setBridgeStatus(status);

        if (status.status === 'completed') {
          toast({
            title: 'Bridge Completed',
            description: 'Tokens successfully bridged to Aptos!',
          });
          return;
        }

        if (status.status === 'failed') {
          toast({
            title: 'Bridge Failed',
            description: status.error || 'Bridge transfer failed',
            variant: 'destructive',
          });
          return;
        }

        // Continue polling if still pending
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else {
          toast({
            title: 'Bridge Status Check Timeout',
            description: 'Unable to verify bridge status. Please check manually.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error polling bridge status:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000);
        }
      }
    };

    // Start polling after initial delay
    setTimeout(poll, 5000);
  }, [toast]);

  const getSolanaUSDCBalance = useCallback(async (): Promise<string> => {
    try {
      if (!wallet.connected || !wallet.wallet) {
        return '0';
      }

      const solanaAddress = getSolanaWalletAddress(wallet.wallet);
      if (!solanaAddress) {
        return '0';
      }

      const bridgeService = WormholeBridgeService.getInstance();
      return await bridgeService.getSolanaUSDCBalance(solanaAddress);
    } catch (error) {
      console.error('Error getting Solana USDC balance:', error);
      return '0';
    }
  }, [wallet]);

  return {
    bridge,
    isLoading,
    bridgeStatus,
    getSolanaUSDCBalance,
  };
}

