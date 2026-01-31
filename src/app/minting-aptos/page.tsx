"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const SOURCE_DOMAIN_SOLANA = "5";

function MintingAptosContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [signature, setSignature] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  useEffect(() => {
    const sig = searchParams.get("signature");
    if (sig) setSignature(sig);
  }, [searchParams]);

  const handleMint = async () => {
    if (!signature.trim()) {
      toast({
        title: "Error",
        description: "Please enter Solana transaction signature",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/aptos/mint-cctp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: signature.trim(),
          sourceDomain: SOURCE_DOMAIN_SOLANA,
          finalRecipient: "0x0000000000000000000000000000000000000000000000000000000000000000", // recipient from message; API requires a value
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || data.message || `Server error: ${response.status}`;
        console.error('[Minting Aptos] Server error response:', data);
        throw new Error(errorMessage);
      }

      // API returns 200 + pending when attestation is not ready yet (no tx submitted)
      if (data.data?.pending === true) {
        toast({
          title: "Attestation not ready yet",
          description: data.data?.message || "Wait 1–2 minutes after the burn and try again.",
          variant: "destructive",
        });
        return;
      }

      const txHash = data.data?.transaction?.hash;
      const explorerUrl = txHash
        ? `https://explorer.aptoslabs.com/txn/${txHash}?network=mainnet`
        : null;

      if (txHash) setLastTxHash(txHash);

      toast({
        title: txHash ? "Mint submitted" : "Success",
        description: txHash
          ? "Transaction sent. Open the link below to check status. If no credits — check if the transaction reverted in Explorer."
          : `Account: ${data.data?.accountAddress ?? "N/A"}`,
      });
    } catch (error: any) {
      console.error('[Minting Aptos] Error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process minting request",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>Aptos CCTP Minting</CardTitle>
          <CardDescription>
            Enter Solana burn transaction signature. The server will fetch attestation and mint USDC on Aptos to the address from the burn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="signature">Solana transaction signature</Label>
              <Input
                id="signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="FoQTrVrvLC7X8DxgQQjofznpuxfgivzknrcSZmWzjoANA1FCEMzC6PwbJS7BoYsWbE3ad5sBkavuGuYd4kWhR5G"
                className="font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleMint}
              disabled={isProcessing || !signature.trim()}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? "Processing..." : "Mint USDC on Aptos"}
            </Button>

            {lastTxHash && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
                <p className="font-medium text-green-800">Transaction submitted</p>
                <p className="mt-1 text-green-700">
                  If no credits on the recipient — open the link and check status (success / reverted).
                </p>
                <Link
                  href={`https://explorer.aptoslabs.com/txn/${lastTxHash}?network=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block font-mono text-green-800 underline"
                >
                  View transaction in Aptos Explorer →
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MintingAptosPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6 max-w-6xl">Loading...</div>}>
      <MintingAptosContent />
    </Suspense>
  );
}

