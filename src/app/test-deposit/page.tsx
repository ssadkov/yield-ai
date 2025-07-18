"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useDeposit } from "@/lib/hooks/useDeposit";
import { useTransactionSubmitter } from "@/lib/hooks/useTransactionSubmitter";
import { Badge } from "@/components/ui/badge";
import { AptBalanceService } from "@/lib/services/aptBalance";
import { GasStationService } from "@/lib/services/gasStation";

// Available tokens for testing
const AVAILABLE_TOKENS = [
  {
    symbol: "USDC (Native)",
    address: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
    decimals: 6,
    market: "0x2c4e0bb55272f9c120ffd5a414c10244005caf9c1b14527cea3df7074c5bf623"
  },
  {
    symbol: "USDC (Thala)",
    address: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
    decimals: 6,
    market: "0xa9c51ca3bcd93978d0c4aada7c4cf47c0791caced3cdc4e15f2c8e0797d1f93c"
  },
  {
    symbol: "USDT",
    address: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT",
    decimals: 6,
    market: "0x447b3b516546f28e8c4f6825a6287b09161659e7c500c599c29c28a8492844b8"
  },
  {
    symbol: "APT",
    address: "0x1::aptos_coin::AptosCoin",
    decimals: 8,
    market: "0x761a97787fa8b3ae0cef91ebc2d96e56cc539df5bc88dadabee98ae00363a831"
  },
  {
    symbol: "WETH",
    address: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH",
    decimals: 8,
    market: "0x548cf587bd918a0005b3372a1d23e64b18ace3c61962f087a21eac52cf228504"
  }
];

export default function TestDepositPage() {
  const { account, connected } = useWallet();
  const { submitTransaction, isConnected, hasSignAndSubmitTransaction } = useTransactionSubmitter();
  const { deposit, isLoading } = useDeposit();
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0); // USDC by default
  const [amount, setAmount] = useState("1000000"); // 1 USDC (6 decimals)
  const [protocolKey, setProtocolKey] = useState("echelon");
  const [aptBalance, setAptBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [gasStationAvailable, setGasStationAvailable] = useState(false);

  const selectedToken = AVAILABLE_TOKENS[selectedTokenIndex];

  // Load APT balance when wallet connects
  useEffect(() => {
    const loadAptBalance = async () => {
      if (!account?.address) {
        setAptBalance(null);
        return;
      }

      setIsLoadingBalance(true);
      try {
        const balance = await AptBalanceService.getAptBalance(account.address.toString());
        setAptBalance(balance);
      } catch (error) {
        console.error('Failed to load APT balance:', error);
        setAptBalance(null);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    loadAptBalance();
  }, [account?.address]);

  // Check gas station availability
  useEffect(() => {
    const gasStationService = GasStationService.getInstance();
    setGasStationAvailable(gasStationService.isAvailable());
  }, []);

  const handleTestDeposit = async () => {
    if (!account?.address) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      console.log("Testing deposit with unified submitter...");
      console.log("Selected token:", selectedToken);
      console.log("Amount:", amount);
      
      const result = await deposit(
        protocolKey as any,
        selectedToken.address,
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
          maxGasAmount: 20000,
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

  const formatAmount = (amount: string, decimals: number) => {
    const num = parseInt(amount) / Math.pow(10, decimals);
    return `${num} ${selectedToken.symbol}`;
  };

  const handleTokenChange = (index: number) => {
    setSelectedTokenIndex(index);
    const token = AVAILABLE_TOKENS[index];
    // Reset amount to 1 token of the new type
    setAmount(Math.pow(10, token.decimals).toString());
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Unified Transaction Submitter - Echelon USDC</CardTitle>
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
            <div>
              <Label>APT Balance</Label>
              <div className="mt-2">
                {isLoadingBalance ? (
                  <Badge variant="secondary">Loading...</Badge>
                ) : aptBalance !== null ? (
                  <Badge variant={aptBalance > 0 ? "default" : "destructive"}>
                    {aptBalance > 0 ? `${aptBalance.toFixed(4)} APT` : "0 APT (Gas Station)"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Unknown</Badge>
                )}
              </div>
            </div>
            <div>
              <Label>Gas Station</Label>
              <div className="mt-2">
                <Badge variant={gasStationAvailable ? "default" : "destructive"}>
                  {gasStationAvailable ? "Available" : "Not Available"}
                </Badge>
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
                disabled
              />
            </div>
            <div>
              <Label>Token Selection</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {AVAILABLE_TOKENS.map((token, index) => (
                  <Button
                    key={token.address}
                    variant={selectedTokenIndex === index ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTokenChange(index)}
                  >
                    {token.symbol}
                  </Button>
                ))}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <strong>Selected:</strong> {selectedToken.symbol} ({selectedToken.address.slice(0, 20)}...)
              </div>
            </div>
            <div>
              <Label htmlFor="amount">Amount (in smallest units)</Label>
              <Input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000000"
              />
              <div className="text-sm text-gray-500 mt-1">
                {formatAmount(amount, selectedToken.decimals)}
              </div>
            </div>
            <div>
              <Label>Market Address</Label>
              <div className="mt-2 text-sm text-gray-600 font-mono">
                {selectedToken.market}
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <Button 
              onClick={handleTestDeposit} 
              disabled={!connected || isLoading}
              className="flex-1"
            >
              {isLoading ? "Testing..." : `Test ${selectedToken.symbol} Deposit`}
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
            <p>This page tests the new unified transaction submitter with Echelon protocol.</p>
            <p>Selected token: <strong>{selectedToken.symbol}</strong> ({selectedToken.address})</p>
            <p>Market: <strong>{selectedToken.market}</strong></p>
            <p>Check the browser console for detailed logs.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 