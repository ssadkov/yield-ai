'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function TestWalletDebugPage() {
  const [address, setAddress] = useState('56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97');
  const [isLoading, setIsLoading] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [error, setError] = useState('');

  const testWalletAPI = async () => {
    setIsLoading(true);
    setError('');
    setDebugData(null);

    try {
      // Test 1: Direct API call
      console.log('Testing wallet API for address:', address);
      
      const response = await fetch(`/api/wallet/${address}/balance`);
      const data = await response.json();
      
      console.log('API Response:', data);
      
      setDebugData({
        apiResponse: data,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

    } catch (err) {
      console.error('Error testing wallet API:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const testAptosAPI = async () => {
    setIsLoading(true);
    setError('');
    setDebugData(null);

    try {
      // Test 2: Direct Aptos API call
      console.log('Testing Aptos API for address:', address);
      
      const response = await fetch(`/api/aptos/walletBalance?address=${address}`);
      const data = await response.json();
      
      console.log('Aptos API Response:', data);
      
      setDebugData({
        aptosApiResponse: data,
        status: response.status,
        statusText: response.statusText
      });

    } catch (err) {
      console.error('Error testing Aptos API:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const testWalletService = async () => {
    setIsLoading(true);
    setError('');
    setDebugData(null);

    try {
      // Test 3: Direct service call
      console.log('Testing wallet service for address:', address);
      
      const response = await fetch('/api/test-wallet-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address })
      });
      
      const data = await response.json();
      console.log('Service Response:', data);
      
      setDebugData({
        serviceResponse: data,
        status: response.status,
        statusText: response.statusText
      });

    } catch (err) {
      console.error('Error testing wallet service:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Wallet API Debug Tool</CardTitle>
            <CardDescription>
              Test different parts of the wallet API to debug issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Wallet Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter Aptos wallet address"
              />
            </div>

            <div className="flex gap-4">
              <Button onClick={testWalletAPI} disabled={isLoading}>
                Test Wallet API
              </Button>
              <Button onClick={testAptosAPI} disabled={isLoading}>
                Test Aptos API
              </Button>
              <Button onClick={testWalletService} disabled={isLoading}>
                Test Wallet Service
              </Button>
            </div>

            {error && (
              <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                Error: {error}
              </div>
            )}

            {debugData && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Debug Results:</h3>
                <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
                  {JSON.stringify(debugData, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
