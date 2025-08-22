"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { WalletConnect } from "@/components/WalletConnect";

export default function TestAavePage() {
  const { account } = useWallet();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testAddress = address || account?.address?.toString() || "";

  const checkPositions = async () => {
    if (!testAddress) {
      setError("Please provide an address or connect wallet");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setData(null);

      const response = await fetch(`/api/protocols/aave/positions?address=${testAddress}`);
      const result = await response.json();

      if (result.success) {
        setData(result);
      } else {
        setError(result.error || "Failed to fetch data");
      }
    } catch (err) {
      console.error("Error checking Aave positions:", err);
      setError("Failed to check positions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Test Aave Protocol Integration</h1>
        <p className="text-muted-foreground">
          Test the Aave protocol integration and check user positions
        </p>
      </div>

      <div className="grid gap-6">
        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle>Wallet Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <WalletConnect />
          </CardContent>
        </Card>

        {/* Address Input */}
        <Card>
          <CardHeader>
            <CardTitle>Test Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="address">Wallet Address</Label>
              <Input
                id="address"
                placeholder="Enter Aptos address or use connected wallet"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={checkPositions} 
                disabled={loading || !testAddress}
              >
                {loading ? "Checking..." : "Check Aave Positions"}
              </Button>
              {account?.address && (
                <Badge variant="outline">
                  Using connected wallet: {account.address.toString().slice(0, 8)}...
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {data && (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Net Value</Label>
                    <div className="text-2xl font-bold">
                      ${data.totalValue?.toFixed(2) || "0.00"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Total Deposits</Label>
                    <div className="text-lg font-semibold text-green-600">
                      ${data.totalDepositValue?.toFixed(2) || "0.00"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Total Borrows</Label>
                    <div className="text-lg font-semibold text-red-600">
                      ${data.totalBorrowValue?.toFixed(2) || "0.00"}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Positions Count</Label>
                  <div className="text-lg font-semibold">
                    {data.data?.length || 0} positions
                  </div>
                </div>

                {data.data && data.data.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Position Details</Label>
                    <div className="mt-2 space-y-2">
                      {data.data.map((position: any, index: number) => (
                        <div key={index} className="p-3 border rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">
                              {position.symbol} ({position.name})
                            </div>
                            <Badge variant={position.usage_as_collateral_enabled ? "default" : "secondary"}>
                              {position.usage_as_collateral_enabled ? "Collateral" : "No Collateral"}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Deposit</div>
                              <div className="font-medium text-green-600">
                                {position.deposit_amount?.toFixed(6)} {position.symbol}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ${position.deposit_value_usd?.toFixed(2)}
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-muted-foreground">Borrow</div>
                              <div className="font-medium text-red-600">
                                {position.borrow_amount?.toFixed(6)} {position.symbol}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ${position.borrow_value_usd?.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-xs text-muted-foreground mt-2">
                            Asset: {position.underlying_asset?.slice(0, 8)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Raw Response</Label>
                  <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-destructive">{error}</div>
            </CardContent>
          </Card>
        )}

        {/* API Info */}
        <Card>
          <CardHeader>
            <CardTitle>API Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <strong>Endpoint:</strong> <code>/api/protocols/aave/positions</code>
            </div>
            <div>
              <strong>Method:</strong> GET
            </div>
            <div>
              <strong>Parameters:</strong> <code>address</code> (query parameter)
            </div>
            <div>
              <strong>Status:</strong> <Badge variant="default">Live Implementation</Badge>
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <strong>Note:</strong> This implementation now uses real Aave Aptos contract calls to fetch 
              user positions, deposits, and borrows. It calculates actual amounts using liquidity and 
              borrow indices with RAY28 scaling (1e28).
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
