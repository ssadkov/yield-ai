'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface TokenInfoResult {
  success: boolean;
  data?: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    price: number | null;
    logoUrl: string | null;
    source: string;
    market?: string;
    supplyCap?: number;
    borrowCap?: number;
  };
  error?: string;
}

export default function TestTokenLookupPage() {
  const [address, setAddress] = useState('0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TokenInfoResult | null>(null);

  const testLookup = async () => {
    if (!address) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch(`/api/tokens/info?address=${encodeURIComponent(address)}`);
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Token Lookup Test</h1>
        <p className="text-muted-foreground">
          Test universal token lookup with fallback to protocol APIs (Echelon, Panora)
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Token Address</label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter token address (faAddress or tokenAddress)"
            className="font-mono"
          />
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={testLookup} 
            disabled={!address || loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Looking up...
              </>
            ) : (
              'Test Lookup'
            )}
          </Button>
        </div>

        <div className="space-y-2 pt-4 border-t">
          <div className="text-sm font-medium mb-2">Quick Test Cases:</div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddress('0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79')}
            >
              Echelon LP Token (sUSDe/USDC.x)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddress('0xa')}
            >
              APT (tokenList)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddress('0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa')}
            >
              USDC (tokenList)
            </Button>
          </div>
        </div>
      </Card>

      {result && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Result</h2>
            <Badge variant={result.success ? 'default' : 'destructive'}>
              {result.success ? 'Success' : 'Error'}
            </Badge>
          </div>

          {result.success && result.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Symbol</div>
                  <div className="font-semibold text-lg">{result.data.symbol}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Source</div>
                  <Badge variant="outline">{result.data.source}</Badge>
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground">Name</div>
                <div className="font-medium">{result.data.name}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Decimals</div>
                  <div className="font-mono">{result.data.decimals}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Price</div>
                  <div className="font-mono">
                    {result.data.price ? `$${result.data.price.toFixed(4)}` : 'N/A'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">Address</div>
                <div className="font-mono text-xs bg-muted p-2 rounded break-all">
                  {result.data.address}
                </div>
              </div>

              {result.data.logoUrl && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Logo</div>
                  <img 
                    src={result.data.logoUrl} 
                    alt={result.data.symbol}
                    className="w-12 h-12 rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {result.data.source === 'echelon' && (
                <div className="pt-4 border-t space-y-2">
                  <div className="text-sm font-medium">Echelon-specific Data</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {result.data.market && (
                      <div>
                        <div className="text-muted-foreground">Market</div>
                        <div className="font-mono text-xs break-all">{result.data.market}</div>
                      </div>
                    )}
                    {result.data.supplyCap !== undefined && (
                      <div>
                        <div className="text-muted-foreground">Supply Cap</div>
                        <div>{result.data.supplyCap}</div>
                      </div>
                    )}
                    {result.data.borrowCap !== undefined && (
                      <div>
                        <div className="text-muted-foreground">Borrow Cap</div>
                        <div>{result.data.borrowCap}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="text-sm font-medium mb-2">Full Response</div>
                <pre className="bg-muted p-4 rounded text-xs overflow-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-red-500">
              <div className="font-medium">Error:</div>
              <div className="text-sm">{result.error || 'Unknown error'}</div>
            </div>
          )}
        </Card>
      )}

      <Card className="p-6 space-y-4 bg-muted/30">
        <h3 className="font-semibold">How It Works</h3>
        <div className="text-sm space-y-2">
          <p>
            This test page demonstrates the universal token lookup system with protocol API fallbacks:
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li><strong>tokenList.json</strong> - Fast lookup for common tokens (USDC, APT, etc.)</li>
            <li><strong>Echelon API</strong> - Fallback for Echelon-specific tokens (LP tokens, collateral tokens)</li>
            <li><strong>Panora API</strong> - Fallback for Panora tokens and general lookup</li>
          </ol>
          <p className="pt-2">
            Results are cached for 5 minutes to prevent excessive API calls.
          </p>
        </div>
      </Card>
    </div>
  );
}
