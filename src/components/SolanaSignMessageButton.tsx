"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAptosClient } from "@/contexts/AptosClientContext";

const TRANSFER_AMOUNT_OCTAS = BigInt(1_000_000); // 0.001 APT

export function SolanaSignMessageButton() {
  const { connected, wallet, account, signMessage, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();
  const aptosClient = useAptosClient();
  const [isSigning, setIsSigning] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

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

      if (!signAndSubmitTransaction) {
        throw new Error("Wallet does not support signAndSubmitTransaction");
      }

      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: "0x1::aptos_account::transfer",
          typeArguments: [],
          functionArguments: [account.address, Number(TRANSFER_AMOUNT_OCTAS)],
        },
      });

      toast({
        title: "Transfer submitted",
        description: `Hash: ${response.hash}`,
      });
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

