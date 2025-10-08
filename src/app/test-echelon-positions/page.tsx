'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { TokenInfoService } from '@/lib/services/tokenInfoService';

// Mock position data for testing
const MOCK_POSITIONS = [
  {
    coin: '0xa', // APT - should be in tokenList
    amount: '100000000', // 1 APT
    type: 'supply',
    market: '0x123...'
  },
  {
    coin: '0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79', // LP token - should use fallback
    amount: '150000000', // 1.5 LP tokens
    type: 'supply',
    market: '0x9c22785c5247e8bc491b2c19f25bbc313c5cd683a23a736bb358195bfbe81f1'
  },
  {
    coin: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa', // USDC - should be in tokenList
    amount: '100000000', // 100 USDC
    type: 'supply',
    market: '0x456...'
  }
];

interface Position {
  coin: string;
  amount: string;
  type: string;
  market: string;
}

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  price: number | null;
  source: string;
}

export default function TestEchelonPositionsPage() {
  const [positions] = useState<Position[]>(MOCK_POSITIONS);
  const [tokenInfo, setTokenInfo] = useState<Record<string, TokenInfo>>({});
  const [loading, setLoading] = useState(false);

  const testTokenInfoLoading = async () => {
    setLoading(true);
    const newTokenInfo: Record<string, TokenInfo> = {};
    
    console.log('[TestEchelonPositions] Starting token info loading...');
    
    for (const position of positions) {
      try {
        // Simulate the logic from EchelonPositions component
        const service = TokenInfoService.getInstance();
        const info = await service.getTokenInfo(position.coin);
        
        if (info) {
          newTokenInfo[position.coin] = {
            symbol: info.symbol,
            name: info.name,
            decimals: info.decimals,
            price: info.price,
            source: info.source
          };
          console.log(`[TestEchelonPositions] Loaded: ${info.symbol} from ${info.source}`);
        } else {
          console.warn(`[TestEchelonPositions] No info found for ${position.coin}`);
        }
      } catch (error) {
        console.error(`[TestEchelonPositions] Error loading ${position.coin}:`, error);
      }
    }
    
    setTokenInfo(newTokenInfo);
    setLoading(false);
  };

  const calculatePositionValue = (position: Position) => {
    const info = tokenInfo[position.coin];
    if (!info || !info.price) return 'N/A';
    
    const amount = parseFloat(position.amount) / Math.pow(10, info.decimals);
    return (amount * info.price).toFixed(2);
  };

  const formatAmount = (position: Position) => {
    const info = tokenInfo[position.coin];
    if (!info) return 'Loading...';
    
    const amount = parseFloat(position.amount) / Math.pow(10, info.decimals);
    return `${amount.toFixed(4)} ${info.symbol}`;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Test Echelon Positions</h1>
        <p className="text-muted-foreground">
          Simulating how EchelonPositions component loads token information with fallback
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Mock Positions</h2>
          <Button 
            onClick={testTokenInfoLoading} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Token Info...
              </>
            ) : (
              'Load Token Info'
            )}
          </Button>
        </div>

        <div className="space-y-4">
          {positions.map((position, index) => {
            const info = tokenInfo[position.coin];
            const value = calculatePositionValue(position);
            
            return (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {info ? info.symbol : 'Loading...'}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={position.type === 'supply' ? 'default' : 'secondary'}>
                      {position.type}
                    </Badge>
                    {info && (
                      <Badge variant="outline">
                        {info.source}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Amount</div>
                    <div className="font-mono">{formatAmount(position)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Value</div>
                    <div className="font-mono">${value}</div>
                  </div>
                </div>
                
                {info && (
                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                    <div>
                      <div>Name:</div>
                      <div className="font-mono">{info.name}</div>
                    </div>
                    <div>
                      <div>Price:</div>
                      <div className="font-mono">${info.price?.toFixed(4) || 'N/A'}</div>
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground">
                  <div>Address:</div>
                  <div className="font-mono break-all">{position.coin}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-medium mb-2">Expected Results:</h3>
          <ul className="text-sm space-y-1">
            <li>✅ <strong>APT (0xa):</strong> Should load from tokenList</li>
            <li>✅ <strong>sUSDe/USDC.x:</strong> Should load from Echelon API (~$102)</li>
            <li>✅ <strong>USDC:</strong> Should load from tokenList</li>
          </ul>
        </div>
      </Card>

      <Card className="p-6 space-y-4 bg-muted/30">
        <h3 className="font-semibold">How This Works</h3>
        <div className="text-sm space-y-2">
          <p>
            This simulates the exact logic used in EchelonPositions component:
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li>Iterate through positions</li>
            <li>Call <code>TokenInfoService.getInstance().getTokenInfo()</code></li>
            <li>Service checks: tokenList → Echelon API → Panora API</li>
            <li>Display token info with source and price</li>
          </ol>
          <p className="pt-2">
            Check browser console for detailed logs of the loading process.
          </p>
        </div>
      </Card>
    </div>
  );
}
