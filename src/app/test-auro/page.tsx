"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function TestAuroPage() {
  const { account } = useWallet();
  const [walletAddress, setWalletAddress] = useState(account?.address?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState<string[]>([]);
  const [positionInfo, setPositionInfo] = useState<any[]>([]);
  const [collectionAddress, setCollectionAddress] = useState<string>("");
  const [standardizedCollectionAddress, setStandardizedCollectionAddress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string>("");

  // Auro Finance addresses (mainnet)
  const AURO_ADDRESS = "0x50a340a19e6ada1be07192c042786ca6a9651d5c845acc8727e8c6416a56a32c";
  const AURO_ROUTER_ADDRESS = "0x50a340a19e6ada1be07192c042786ca6a9651d5c845acc8727e8c6416a56a32c";

  const handleFetchPositions = async () => {
    if (!walletAddress) {
      setError("Please enter a wallet address");
      return;
    }

    setLoading(true);
    setError(null);
    setAuthError(false);
    setDebugInfo("");
    setPositions([]);
    setPositionInfo([]);
    setCollectionAddress("");
    setStandardizedCollectionAddress("");

    try {
      const apiUrl = `/api/protocols/auro/userPositions?address=${encodeURIComponent(walletAddress)}`;
      setDebugInfo(`Making request to: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      setDebugInfo(prev => prev + `\nResponse status: ${response.status}`);
      
      const data = await response.json();
      setDebugInfo(prev => prev + `\nResponse data: ${JSON.stringify(data, null, 2)}`);
      
      if (response.status === 401) {
        setAuthError(true);
        setError(data.details || "Authentication required");
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch positions");
      }
      
      if (data.success) {
        setPositions(data.positions || []);
        setPositionInfo(data.positionInfo || []);
        setCollectionAddress(data.collectionAddress || "");
        setStandardizedCollectionAddress(data.standardizedCollectionAddress || "");
      } else {
        throw new Error(data.error || "Failed to fetch positions");
      }
    } catch (err) {
      console.error("Error fetching Auro positions:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setDebugInfo(prev => prev + `\nError: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <img 
          src="https://app.auro.finance/logo.png" 
          alt="Auro Finance" 
          className="w-12 h-12 rounded"
        />
        <div>
          <h1 className="text-3xl font-bold">Auro Finance Test Page</h1>
          <p className="text-muted-foreground">
            Test Auro Finance API integration and position fetching
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Fetch User Positions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="wallet-address">Wallet Address</Label>
              <Input
                id="wallet-address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Enter wallet address to test"
                className="mt-1"
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleFetchPositions} 
                disabled={loading || !walletAddress}
              >
                {loading ? "Loading..." : "Fetch Positions"}
              </Button>
              
              {account?.address && (
                <Button 
                  variant="outline"
                  onClick={() => setWalletAddress(account.address.toString())}
                >
                  Use Connected Wallet
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className={`p-4 border rounded-lg ${authError ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
              <p className={authError ? 'text-yellow-800' : 'text-red-600'}>
                {error}
              </p>
              {authError && (
                <div className="mt-2 text-sm text-yellow-700">
                  <p>To fix this issue:</p>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Go to <a href="https://console.aptoslabs.com/" target="_blank" rel="noopener noreferrer" className="underline">Aptos Labs Console</a></li>
                    <li>Create an account and get your API key</li>
                    <li>Add <code className="bg-yellow-100 px-1 rounded">APTOS_API_KEY=your_key_here</code> to your <code className="bg-yellow-100 px-1 rounded">.env.local</code> file</li>
                    <li>Restart the development server</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {debugInfo && (
            <div className="p-4 bg-gray-50 border rounded-lg">
              <Label className="text-xs text-muted-foreground">Debug Information:</Label>
              <pre className="text-xs mt-1 overflow-auto whitespace-pre-wrap">
                {debugInfo}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {collectionAddress && (
        <Card>
          <CardHeader>
            <CardTitle>Collection Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Collection Address:</Label>
                <p className="font-mono text-sm break-all">{collectionAddress}</p>
              </div>
              {standardizedCollectionAddress && (
                <div>
                  <Label className="text-xs text-muted-foreground">Standardized Address:</Label>
                  <p className="font-mono text-sm break-all">{standardizedCollectionAddress}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {positions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Position NFTs Found</CardTitle>
            <p className="text-sm text-muted-foreground">
              Found {positions.length} position NFT(s) for this wallet
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {positions.map((position: any, index: number) => (
                <div key={position.storage_id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="secondary">Position NFT #{index + 1}</Badge>
                      <p className="text-sm font-mono mt-1">Storage ID: {position.storage_id}</p>
                      <p className="text-sm font-mono mt-1">Name: {position.current_token_data?.token_name}</p>
                      {position.current_token_data?.token_uri && (
                        <a href={position.current_token_data.token_uri} target="_blank" rel="noopener noreferrer" className="text-xs underline text-blue-600">
                          Token URI
                        </a>
                      )}
                      <p className="text-xs mt-1">Collection: {position.current_token_data?.current_collection?.collection_name}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !loading && walletAddress && !error && (
        <Card>
          <CardHeader>
            <CardTitle>No Positions Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No Auro Finance positions found for this wallet address. This is normal if the wallet hasn't used Auro Finance yet.
            </p>
          </CardContent>
        </Card>
      )}

      {positionInfo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Position Information</CardTitle>
            <p className="text-sm text-muted-foreground">
              Financial data for each position
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {positionInfo.map((info, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline">Position #{index + 1}</Badge>
                    <p className="text-sm font-mono">{info.address}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Collateral Amount</Label>
                      <p className="font-medium">{info.collateralAmount || "0"} APT</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Debt Amount</Label>
                      <p className="font-medium">{info.debtAmount || "0"} USDA</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Liquidation Price</Label>
                      <p className="font-medium">${info.liquidatePrice || "0"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">AURO_ADDRESS:</Label>
              <p className="font-mono text-xs break-all">{AURO_ADDRESS}</p>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground">AURO_ROUTER_ADDRESS:</Label>
              <p className="font-mono text-xs break-all">{AURO_ROUTER_ADDRESS}</p>
            </div>
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-xs">
                ✅ Real Auro Finance contract addresses are now configured!
              </p>
            </div>
            {!process.env.APTOS_API_KEY && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-xs">
                  ⚠️ APTOS_API_KEY not found. Add it to your .env.local file for full functionality.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 