'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ExternalLink } from 'lucide-react';

export default function TestWalletApiPage() {
  const [address, setAddress] = useState('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
  const [walletData, setWalletData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const testAddresses = [
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    '0x1111111111111111111111111111111111111111111111111111111111111111'
  ];

  const fetchWalletData = async (testAddress: string) => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/wallet/${testAddress}/balance`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setWalletData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet data');
      setWalletData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAddress = (testAddress: string) => {
    setAddress(testAddress);
    fetchWalletData(testAddress);
  };

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Wallet API Test</CardTitle>
          <CardDescription>
            Test the wallet balance API endpoint with different addresses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Wallet Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Aptos wallet address..."
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => fetchWalletData(address)}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Fetch Balance'
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => window.open(`/wallet/${address}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Wallet View
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Test Addresses</Label>
            <div className="flex flex-wrap gap-2">
              {testAddresses.map((testAddr, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestAddress(testAddr)}
                  disabled={isLoading}
                >
                  Test {index + 1}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {walletData && (
        <Card>
          <CardHeader>
            <CardTitle>API Response</CardTitle>
            <CardDescription>
              Raw JSON response from the wallet balance API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600">Total Value</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatUSD(walletData.totalValueUSD)}
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600">Tokens Count</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {walletData.tokens?.length || 0}
                  </p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Timestamp</p>
                  <p className="text-sm font-mono">
                    {new Date(walletData.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Raw JSON Response</Label>
                <pre className="p-4 bg-gray-100 rounded-lg text-sm overflow-auto max-h-96">
                  {JSON.stringify(walletData, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
