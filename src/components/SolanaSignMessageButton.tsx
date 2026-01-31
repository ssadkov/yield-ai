"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { GasStationService } from "@/lib/services/gasStation";
import { useAptosClient } from "@/contexts/AptosClientContext";
import { normalizeAuthenticator } from "@/lib/hooks/useTransactionSubmitter";
import { isDerivedAptosWallet } from "@/lib/aptosWalletUtils";

const TRANSFER_AMOUNT_OCTAS = BigInt(1_000_000); // 0.001 APT

export function SolanaSignMessageButton() {
  const { connected, wallet, account, signMessage, signTransaction } = useWallet();
  const { toast } = useToast();
  const [isSigning, setIsSigning] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const aptosClient = useAptosClient();
  const searchParams = useSearchParams();
  
  // Check if debug mode is enabled via query parameter or env variable
  const isDebugMode = useMemo(() => {
    const debugParam = searchParams.get('debug');
    const envDebug = process.env.NEXT_PUBLIC_DEBUG === 'true';
    return debugParam === 'true' || envDebug;
  }, [searchParams]);

  // Get the same GasStationTransactionSubmitter instance (singleton) for explicit use with x-chain wallets
  const gasStationService = useMemo(() => GasStationService.getInstance(), []);
  const transactionSubmitter = useMemo(() => gasStationService.getTransactionSubmitter(), [gasStationService]);

  const handleSign = async () => {
    if (!connected || !wallet || !signMessage) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Connect a Solana cross-chain wallet first.",
      });
      return;
    }

    setIsSigning(true);
    try {
      const payload = {
        message: "Yield AI test sign message",
        nonce: Date.now().toString(),
        address: true,
        application: true,
        chainId: true,
      };

      await signMessage(payload);

      toast({
        title: "Message signed",
        description: "Signature output in console.",
      });
    } catch (error) {
      console.error("Failed to sign message:", error);
      toast({
        variant: "destructive",
        title: "Signing failed",
        description: error instanceof Error ? error.message : "User rejected the request.",
      });
    } finally {
      setIsSigning(false);
    }
  };

  const handleTransfer = async () => {
    if (!connected || !wallet) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Connect a Solana cross-chain wallet first.",
      });
      return;
    }

    setIsTransferring(true);
    try {
      if (!account?.address) {
        throw new Error("Missing sender address");
      }

      if (!signTransaction) {
        throw new Error("Wallet does not support signTransaction");
      }

      // For x-chain (derived) wallets, use manual approach: build -> sign -> submit via GasStationTransactionSubmitter
      if (isDerivedAptosWallet(wallet)) {
        if (!transactionSubmitter) {
          throw new Error("Gas Station transaction submitter not available");
        }

        console.log('[gas-station] ===== MANUAL TRANSFER FOR X-CHAIN WALLET =====');
        console.log('[gas-station] wallet:', wallet?.name ?? 'unknown');
        console.log('[gas-station] Account address:', account.address.toString());

        const recipientAddress = account.address.toString();

        // Build transaction with withFeePayer: true (required by GasStationTransactionSubmitter)
        // Gas Station will handle the fee payer signing internally
        const transaction = await aptosClient.transaction.build.simple({
          sender: account.address,
          withFeePayer: true, // Required flag for Gas Station to recognize sponsored transaction
          data: {
            function: '0x1::aptos_account::transfer',
            functionArguments: [
              recipientAddress,
              Number(TRANSFER_AMOUNT_OCTAS)
            ]
          },
          options: {
            maxGasAmount: 2000,
            gasUnitPrice: 100,
          }
        });

        console.log('[gas-station] Transaction built, signing...');

        // Sign transaction with wallet
        const walletResult = await signTransaction({
          transactionOrPayload: transaction,
        } as any);

        console.log('[gas-station] Transaction signed, normalizing authenticator...');

        // Normalize authenticator
        const senderAuthenticator = normalizeAuthenticator((walletResult as any)?.authenticator ?? walletResult);

        console.log('[gas-station] Submitting via GasStationTransactionSubmitter...');

        // Submit via GasStationTransactionSubmitter
        // Note: Type casting needed due to version mismatch between ts-sdk versions
        const response = await transactionSubmitter.submitTransaction({
          aptosConfig: aptosClient.config as any,
          transaction: transaction as any,
          senderAuthenticator: senderAuthenticator as any,
        });

        console.log('[gas-station] Transaction submitted, full response:', JSON.stringify(response, null, 2));
        console.log('[gas-station] Response type:', typeof response);
        console.log('[gas-station] Response hash:', response?.hash);
        console.log('[gas-station] Response keys:', response ? Object.keys(response) : 'response is null/undefined');

        if (!response || !response.hash) {
          throw new Error(`Transaction submission failed: no hash returned. Response: ${JSON.stringify(response)}`);
        }

        toast({
          title: "Transfer submitted",
          description: `Hash: ${response.hash}`,
        });
      } else {
        // For native Aptos wallets, use signAndSubmitTransaction (if available)
        throw new Error("Native Aptos wallet - use regular signAndSubmitTransaction");
      }
    } catch (error) {
      console.error("Failed to transfer:", error);
      toast({
        variant: "destructive",
        title: "Transfer failed",
        description: error instanceof Error ? error.message : "User rejected the request.",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  // Only show buttons in debug mode
  if (!isDebugMode) {
    return null;
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleSign} disabled={isSigning}>
        {isSigning ? "Signing..." : "Sign Test Message"}
      </Button>
      <Button variant="outline" size="sm" onClick={handleTransfer} disabled={isTransferring}>
        {isTransferring ? "Transferring..." : "Transfer 0.001 APT"}
      </Button>
    </div>
  );
}

