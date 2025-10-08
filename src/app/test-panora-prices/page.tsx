'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function TestPanoraPricesPage() {
  const [tokenAddress, setTokenAddress] = useState('0x5fabd1b12e39967a3c24e91b7b8f67719a6dacee74f3c8b9fb7d93e855437d2');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testDirectPanoraAPI = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🔍 Testing Panora API with address:', tokenAddress);
      
      // Test both with and without leading zero
      const addresses = [
        tokenAddress,
        // Also test with leading zero if not present
        tokenAddress.replace(/^0x/, '0x0'),
        // And without if present
        tokenAddress.replace(/^0x0+/, '0x')
      ];

      const uniqueAddresses = [...new Set(addresses)];
      
      console.log('📋 Testing addresses:', uniqueAddresses);

      const results = [];

      for (const addr of uniqueAddresses) {
        try {
          const response = await fetch(
            `/api/panora/tokenPrices?chainId=1&tokenAddress=${addr}`
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          results.push({
            requestedAddress: addr,
            success: data.success,
            data: data.data,
            error: data.error
          });

          console.log(`✅ Response for ${addr}:`, data);
        } catch (err) {
          console.error(`❌ Error for ${addr}:`, err);
          results.push({
            requestedAddress: addr,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }

      setResult({
        testedAddresses: uniqueAddresses,
        results
      });

    } catch (err) {
      console.error('❌ Test failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const normalizeAddress = (addr: string) => {
    if (!addr || !addr.startsWith('0x')) return addr;
    return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Panora API - Token Prices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Token Address:
            </label>
            <Input
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x..."
              className="font-mono"
            />
            <div className="mt-2 text-sm text-muted-foreground">
              <div>Original: <code className="bg-muted px-1 py-0.5 rounded">{tokenAddress}</code></div>
              <div>Normalized: <code className="bg-muted px-1 py-0.5 rounded">{normalizeAddress(tokenAddress)}</code></div>
            </div>
          </div>

          <Button 
            onClick={testDirectPanoraAPI}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Testing...' : 'Test Panora API'}
          </Button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Error:</h3>
              <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Tested Addresses:</h3>
                <ul className="text-sm space-y-1">
                  {result.testedAddresses.map((addr: string, i: number) => (
                    <li key={i} className="font-mono text-blue-600">{addr}</li>
                  ))}
                </ul>
              </div>

              {result.results.map((res: any, idx: number) => (
                <div 
                  key={idx}
                  className={`p-4 border rounded-lg ${
                    res.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <h3 className={`font-semibold mb-2 ${
                    res.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    Result for: <code className="text-xs">{res.requestedAddress}</code>
                  </h3>
                  
                  {res.success && res.data && (
                    <div className="space-y-2">
                      {Array.isArray(res.data) && res.data.length > 0 ? (
                        res.data.map((token: any, tokenIdx: number) => (
                          <div key={tokenIdx} className="p-3 bg-white rounded border">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div><strong>Symbol:</strong> {token.symbol}</div>
                              <div><strong>Name:</strong> {token.name}</div>
                              <div><strong>USD Price:</strong> <span className="text-green-600 font-bold">${token.usdPrice}</span></div>
                              <div><strong>Decimals:</strong> {token.decimals}</div>
                              <div className="col-span-2">
                                <strong>Token Address:</strong> 
                                <code className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                                  {token.tokenAddress || 'null'}
                                </code>
                              </div>
                              <div className="col-span-2">
                                <strong>FA Address:</strong> 
                                <code className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                                  {token.faAddress}
                                </code>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-orange-600">No token data returned</div>
                      )}
                    </div>
                  )}
                  
                  {res.error && (
                    <pre className="text-sm text-red-600 whitespace-pre-wrap mt-2">
                      {res.error}
                    </pre>
                  )}
                  
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      View Raw Response
                    </summary>
                    <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-x-auto">
                      {JSON.stringify(res, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="font-semibold mb-2">Problem Explanation:</h3>
            <div className="text-sm space-y-2">
              <p>
                The issue occurs when Panora API returns addresses with leading zeros (e.g., <code>0x05fabd...</code>)
                but the system normalizes addresses by removing leading zeros (e.g., <code>0x5fabd...</code>).
              </p>
              <p className="text-green-600 font-medium">
                ✅ Solution: Save prices under BOTH versions of the address - with and without leading zeros.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

