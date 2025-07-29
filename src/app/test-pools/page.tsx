'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TestPoolsPage() {
  const [url, setUrl] = useState('');
  const [transformCode, setTransformCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testApiSource = async () => {
    if (!url) return;

    setLoading(true);
    try {
      let transform;
      if (transformCode.trim()) {
        try {
          // Create a function from the transform code
          transform = new Function('data', transformCode);
        } catch (error) {
          setResult({
            success: false,
            error: `Invalid transform function: ${error}`
          });
          return;
        }
      }

      const response = await fetch('/api/test/pools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, transform }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: `Request failed: ${error}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Test Pool Sources</h1>
        <p className="text-muted-foreground">
          Test new API sources to ensure they return valid pool data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">API URL</label>
            <Input
              value={url}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
              placeholder="https://your-api.com/pools"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Transform Function (Optional)
            </label>
            <textarea
              value={transformCode}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTransformCode(e.target.value)}
              placeholder={`// Transform your API response to InvestmentData format
return (data.pools || []).map((pool) => ({
  asset: pool.tokenSymbol,
  provider: pool.provider || 'Your Protocol',
  totalAPY: pool.totalAPY,
  depositApy: pool.depositAPY,
  borrowAPY: pool.borrowAPY,
  token: pool.tokenAddress,
  protocol: pool.protocolName || 'Your Protocol'
}));`}
              rows={8}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Button 
            onClick={testApiSource} 
            disabled={loading || !url}
            className="w-full"
          >
            {loading ? 'Testing...' : 'Test API Source'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Test Results
              {result.success ? (
                <Badge variant="default" className="bg-green-500">
                  Success
                </Badge>
              ) : (
                <Badge variant="destructive">Failed</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.error ? (
              <div className="text-red-500">
                <strong>Error:</strong> {result.error}
              </div>
            ) : result.result ? (
              <div className="space-y-4">
                <div>
                  <strong>Status:</strong>{' '}
                  {result.result.isValid ? (
                    <Badge variant="default" className="bg-green-500">
                      Valid
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Invalid</Badge>
                  )}
                </div>

                <div>
                  <strong>Valid Pools:</strong> {result.result.data.length}
                </div>

                {result.result.errors.length > 0 && (
                  <div>
                    <strong className="text-red-500">Errors:</strong>
                    <ul className="list-disc list-inside text-red-500 mt-1">
                      {result.result.errors.map((error: string, index: number) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.result.warnings.length > 0 && (
                  <div>
                    <strong className="text-yellow-500">Warnings:</strong>
                    <ul className="list-disc list-inside text-yellow-500 mt-1">
                      {result.result.warnings.map((warning: string, index: number) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.result.data.length > 0 && (
                  <div>
                    <strong>Sample Pool:</strong>
                    <pre className="bg-gray-100 p-2 rounded mt-2 text-sm overflow-x-auto">
                      {JSON.stringify(result.result.data[0], null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 