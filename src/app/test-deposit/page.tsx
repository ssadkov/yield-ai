"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useDeposit } from "@/lib/hooks/useDeposit";
import { useTransactionSubmitter } from "@/lib/hooks/useTransactionSubmitter";
import { Badge } from "@/components/ui/badge";

export default function TestDepositPage() {
  const { account, connected } = useWallet();
  const { submitTransaction, isConnected, hasSignAndSubmitTransaction } = useTransactionSubmitter();
  const { deposit, isLoading } = useDeposit();
  const [amount, setAmount] = useState("1000000"); // 0.01 APT in octas
  const [protocolKey, setProtocolKey] = useState("echelon");
  const [token, setToken] = useState("0x1::aptos_coin::AptosCoin");

  const handleTestDeposit = async () => {
    if (!account?.address) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      console.log("Testing deposit with unified submitter...");
      const result = await deposit(
        protocolKey as any,
        token,
        BigInt(amount)
      );
      console.log("Deposit result:", result);
      alert("Deposit test completed! Check console for details.");
    } catch (error) {
      console.error("Deposit test failed:", error);
      alert(`Deposit test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTestDirectSubmitter = async () => {
    if (!account?.address) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      console.log("Testing direct submitter...");
      // Create a simple test transaction payload
      const testPayload = {
        data: {
          function: "0x1::coin::transfer",
          typeArguments: ["0x1::aptos_coin::AptosCoin"],
          functionArguments: [account.address.toString(), 1] // Transfer 1 octa to self
        },
        options: {
          maxGasAmount: 100000,
        },
      };

      const result = await submitTransaction(testPayload);
      console.log("Direct submitter result:", result);
      alert("Direct submitter test completed! Check console for details.");
    } catch (error) {
      console.error("Direct submitter test failed:", error);
      alert(`Direct submitter test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Unified Transaction Submitter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Wallet Status</Label>
              <div className="space-y-2 mt-2">
                <Badge variant={connected ? "default" : "destructive"}>
                  {connected ? "Connected" : "Disconnected"}
                </Badge>
                <Badge variant={isConnected ? "default" : "destructive"}>
                  {isConnected ? "Submitter Connected" : "Submitter Disconnected"}
                </Badge>
                <Badge variant={hasSignAndSubmitTransaction ? "default" : "destructive"}>
                  {hasSignAndSubmitTransaction ? "Has Sign Function" : "No Sign Function"}
                </Badge>
              </div>
            </div>
            <div>
              <Label>Wallet Address</Label>
              <div className="mt-2 text-sm text-gray-600">
                {account?.address ? account.address.toString() : "Not connected"}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="protocol">Protocol</Label>
              <Input
                id="protocol"
                value={protocolKey}
                onChange={(e) => setProtocolKey(e.target.value)}
                placeholder="echelon"
              />
            </div>
            <div>
              <Label htmlFor="token">Token</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="0x1::aptos_coin::AptosCoin"
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount (in octas)</Label>
              <Input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000000"
              />
            </div>
          </div>

          <div className="flex space-x-4">
            <Button 
              onClick={handleTestDeposit} 
              disabled={!connected || isLoading}
              className="flex-1"
            >
              {isLoading ? "Testing..." : "Test Deposit Hook"}
            </Button>
            <Button 
              onClick={handleTestDirectSubmitter} 
              disabled={!connected}
              variant="outline"
              className="flex-1"
            >
              Test Direct Submitter
            </Button>
          </div>

          <div className="text-sm text-gray-600">
            <p>This page tests the new unified transaction submitter.</p>
            <p>Check the browser console for detailed logs.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 