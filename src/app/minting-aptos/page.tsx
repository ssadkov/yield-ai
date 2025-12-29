"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function MintingAptosPage() {
  const { toast } = useToast();
  const [sourceDomain, setSourceDomain] = useState<string>("");
  const [signature, setSignature] = useState<string>("");
  const [finalRecipient, setFinalRecipient] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Send data to server for processing
  const handleMint = async () => {
    if (!sourceDomain.trim() || !signature.trim() || !finalRecipient.trim()) {
      toast({
        title: "Error",
        description: "Please enter sourceDomain, signature, and final recipient address",
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
          sourceDomain: sourceDomain.trim(),
          finalRecipient: finalRecipient.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || data.message || `Server error: ${response.status}`;
        console.error('[Minting Aptos] Server error response:', data);
        throw new Error(errorMessage);
      }

      toast({
        title: "Success",
        description: `Attestation processed successfully. Account: ${data.data?.accountAddress || 'N/A'}`,
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
            Enter transaction signature, source domain, and final recipient address.
            The server will fetch attestation data and process the minting transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sourceDomain">Source Domain</Label>
                <Input
                  id="sourceDomain"
                  type="number"
                  value={sourceDomain}
                  onChange={(e) => setSourceDomain(e.target.value)}
                  placeholder="1"
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <Label htmlFor="signature">Transaction Signature</Label>
                <Input
                  id="signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="47C3YgaV4SbJifuZ9yciNbfdjgPHfQTuiKbxgwdrhseYMVVZgwiBJDqLKTtwR2DvZvz1zPw6SwqeUWfkmxS7svEP"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="finalRecipient">Final Recipient Address</Label>
              <Input
                id="finalRecipient"
                value={finalRecipient}
                onChange={(e) => setFinalRecipient(e.target.value)}
                placeholder="0x..."
                className="font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleMint}
              disabled={isProcessing || !sourceDomain.trim() || !signature.trim() || !finalRecipient.trim()}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? "Processing..." : "Mint USDC on Aptos"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

