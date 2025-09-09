"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

export default function TestMoarAPIPage() {
  const { account } = useWallet();
  const [testAddress, setTestAddress] = useState('');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = testAddress || account?.address?.toString() || '';

  const testAPI = async () => {
    if (!address) {
      setError('Please enter an address');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      console.log('🔍 Testing Moar Market API with address:', address);
      const response = await fetch(`/api/protocols/moar/userPositions?address=${address}`);
      const data = await response.json();
      console.log('📊 API Response:', data);
      setApiResponse(data);
    } catch (err) {
      console.error('❌ Error testing API:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Moar Market API Test</h1>
        <p className="text-muted-foreground">Test our Moar Market API endpoint</p>
      </div>

      {/* Address Input */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address">Wallet Address</Label>
            <Input
              id="address"
              value={testAddress}
              onChange={(e) => setTestAddress(e.target.value)}
              placeholder={account?.address?.toString() || "Enter wallet address"}
              className="mt-1"
            />
            {account?.address && (
              <p className="text-sm text-muted-foreground mt-1">
                Connected wallet: {account.address.toString()}
              </p>
            )}
          </div>
          
          <Button onClick={testAPI} disabled={isLoading || !address}>
            {isLoading ? 'Testing API...' : 'Test Moar Market API'}
          </Button>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* API Response */}
      {apiResponse && (
        <Card>
          <CardHeader>
            <CardTitle>API Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  apiResponse.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {apiResponse.success ? 'Success' : 'Error'}
                </span>
              </div>
              
              {apiResponse.error && (
                <div className="text-red-600">
                  <strong>Error:</strong> {apiResponse.error}
                </div>
              )}
              
              <div>
                <span className="font-medium">Positions found:</span> {apiResponse.data?.length || 0}
              </div>
              
              <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                <pre className="text-xs">
                  {JSON.stringify(apiResponse, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>1. Enter a wallet address (or use connected wallet)</p>
            <p>2. Click "Test Moar Market API" to call our internal API</p>
            <p>3. Check the response to see if positions are found</p>
            <p>4. Compare with the raw data from the main test page</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
