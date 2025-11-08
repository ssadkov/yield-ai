"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function SolanaSignMessageButton() {
  const { connected, wallet, signMessage } = useWallet();
  const { toast } = useToast();
  const [isSigning, setIsSigning] = useState(false);

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
        application: "Yield AI",
        chainId: true,
      };

      const response = await signMessage(payload);

      toast({
        title: "Message signed",
        description: "Signature copied to console.",
      });
      console.log("Solana signMessage response:", response);
    } catch (error) {
      console.error("Failed to sign message:", error);
      toast({
        variant: "destructive",
        title: "Signing failed",
        description:
          error instanceof Error ? error.message : "User rejected the request.",
      });
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleSign} disabled={isSigning}>
      {isSigning ? "Signing..." : "Sign Test Message"}
    </Button>
  );
}

