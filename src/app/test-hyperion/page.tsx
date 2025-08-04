'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

function formatNumber(num: number | string) {
  return Number(num).toLocaleString('en-US');
}

export default function TestHyperionPage() {
  const [hyperionPools, setHyperionPools] = useState<any[]>([]);
  const [filteredPools, setFilteredPools] = useState<any[]>([]);
  const [transformedPools, setTransformedPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volumeThreshold, setVolumeThreshold] = useState(1000);

  const testHyperionPools = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Test direct Hyperion API
      const response = await fetch('/api/protocols/hyperion/pools');
      if (!response.ok) {
        throw new Error(`Hyperion API returned ${response.status}`);
      }
      
      const data = await response.json();
      const allPools = data.data || [];
      setHyperionPools(allPools);
      
      // Filter pools by dailyVolumeUSD
      const filtered = allPools.filter((pool: any) => {
        const dailyVolume = parseFloat(pool.dailyVolumeUSD || pool.pool?.dailyVolumeUSD || "0");
        return dailyVolume > volumeThreshold;
      });
      setFilteredPools(filtered);
      
      // Test transformation on filtered pools
      if (filtered.length > 0) {
        const transform = (pools: any[]) => {
          return pools.map((pool: any) => {
            const feeAPR = parseFloat(pool.feeAPR || "0");
            const farmAPR = parseFloat(pool.farmAPR || "0");
            const totalAPY = feeAPR + farmAPR;
            
            return {
              asset: `${pool.token1Info?.symbol || 'Unknown'}/${pool.token2Info?.symbol || 'Unknown'}`,
              provider: 'Hyperion',
              totalAPY: totalAPY,
              depositApy: totalAPY,
              borrowAPY: 0,
              token: pool.poolId || pool.id,
              protocol: 'Hyperion',
              dailyVolumeUSD: parseFloat(pool.dailyVolumeUSD || "0"),
              tvlUSD: parseFloat(pool.tvlUSD || "0"),
              // Token details for Investment Ideas
              token1Info: pool.token1Info,
              token2Info: pool.token2Info
            };
          });
        };
        
        const transformed = transform(filtered);
        setTransformedPools(transformed);
      } else {
        setTransformedPools([]);
      }
      
    } catch (error) {
      setError(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testHyperionPools();
  }, [volumeThreshold]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Test Hyperion Pools Integration</h1>
        <p className="text-muted-foreground">
          Testing Hyperion pools API and transformation to InvestmentData format
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Hyperion Pools Test
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm font-medium">Volume Threshold:</label>
              <input
                type="number"
                value={volumeThreshold}
                onChange={(e) => setVolumeThreshold(Number(e.target.value))}
                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                min="0"
                step="1000"
              />
              <span className="text-sm text-gray-500">USD</span>
              <Button 
                onClick={testHyperionPools} 
                disabled={loading}
                size="sm"
              >
                {loading ? 'Testing...' : 'Refresh'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-red-500 mb-4">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="mb-4 p-3 bg-blue-50 rounded">
            <div className="text-sm">
              <strong>Filter:</strong> Showing pools with daily volume &gt; {formatNumber(volumeThreshold)}
            </div>
            <div className="text-sm text-gray-600">
              Total pools: {hyperionPools.length} | Filtered pools: {filteredPools.length}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Filtered Hyperion Data</h3>
              <div className="text-sm text-muted-foreground mb-2">
                Pools with volume &gt; {formatNumber(volumeThreshold)}: {filteredPools.length}
              </div>
              {filteredPools.slice(0, 5).map((pool, index) => {
                const p = pool.pool || pool;
                return (
                  <div key={index} className="border p-3 rounded mb-3">
                    <div className="font-medium mb-2">
                      {p.token1Info?.symbol || '-'} / {p.token2Info?.symbol || '-'}
                    </div>
                    {/* Token 1 */}
                    <div className="mb-2 p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        {p.token1Info?.logoUrl && (
                          <img
                            src={p.token1Info.logoUrl}
                            alt={p.token1Info.symbol}
                            width={24}
                            height={24}
                            className="object-contain rounded"
                          />
                        )}
                        <span className="font-medium text-sm">{p.token1Info?.symbol}</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Name: {p.token1Info?.name}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        Address: {p.token1}
                      </div>
                    </div>
                    {/* Token 2 */}
                    <div className="mb-2 p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        {p.token2Info?.logoUrl && (
                          <img
                            src={p.token2Info.logoUrl}
                            alt={p.token2Info.symbol}
                            width={24}
                            height={24}
                            className="object-contain rounded"
                          />
                        )}
                        <span className="font-medium text-sm">{p.token2Info?.symbol}</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Name: {p.token2Info?.name}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        Address: {p.token2}
                      </div>
                    </div>
                    {/* Pool Stats */}
                    <div className="text-xs space-y-1">
                      <div>Pool ID: <span className="font-mono">{pool.id || p.poolId}</span></div>
                      <div>Fee APR: {parseFloat(pool.feeAPR || p.feeAPR || "0").toFixed(2)}%</div>
                      <div>Farm APR: {parseFloat(pool.farmAPR || p.farmAPR || "0").toFixed(2)}%</div>
                      <div className="font-semibold text-green-600">
                        Daily Volume: ${formatNumber(pool.dailyVolumeUSD || p.dailyVolumeUSD || "0")}
                      </div>
                      <div>TVL: ${formatNumber(pool.tvlUSD || p.tvlUSD || "0")}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Transformed Data for Investment Ideas</h3>
              <div className="text-sm text-muted-foreground mb-2">
                Transformed pools: {transformedPools.length}
              </div>
              {transformedPools.slice(0, 5).map((pool, index) => (
                <div key={index} className="border p-3 rounded mb-3">
                  <div className="font-medium mb-2">{pool.asset}</div>
                  <div className="text-xs text-gray-500 mb-2">
                    Protocol: {pool.protocol}
                  </div>
                  
                  {/* Token Pair Display */}
                  <div className="flex items-center gap-2 mb-2">
                    {pool.token1Info?.logoUrl && (
                      <div className="w-5 h-5 relative">
                        <Image 
                          src={pool.token1Info.logoUrl} 
                          alt={pool.token1Info.symbol}
                          width={20}
                          height={20}
                          className="object-contain rounded"
                        />
                      </div>
                    )}
                    <span className="text-sm">{pool.token1Info?.symbol}</span>
                    <span className="text-gray-400">/</span>
                    {pool.token2Info?.logoUrl && (
                      <div className="w-5 h-5 relative">
                        <Image 
                          src={pool.token2Info.logoUrl} 
                          alt={pool.token2Info.symbol}
                          width={20}
                          height={20}
                          className="object-contain rounded"
                        />
                      </div>
                    )}
                    <span className="text-sm">{pool.token2Info?.symbol}</span>
                  </div>

                  <div className="text-xs space-y-1">
                    <div>
                      Total APR: <span className="text-green-600 font-semibold">{pool.totalAPY.toFixed(2)}%</span>
                    </div>
                    <div className="font-semibold text-blue-600">
                      Volume: ${pool.dailyVolumeUSD.toLocaleString()}
                    </div>
                    <div>TVL: ${pool.tvlUSD.toLocaleString()}</div>
                    <div className="text-gray-500 font-mono text-xs">
                      Pool: {pool.token}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Data Structure Description */}
          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-3">Data Structure for Investment Ideas</h3>
            <div className="text-sm space-y-2">
              <p><strong>Raw Hyperion Pool Structure:</strong></p>
              <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
{`{
  poolId: string,
  token1: string,           // Token 1 address
  token2: string,           // Token 2 address
  token1Info: {
    symbol: string,         // Token symbol (e.g., "APT")
    name: string,           // Token name (e.g., "Aptos Coin")
    logoUrl: string,        // Token logo URL
    decimals: number        // Token decimals
  },
  token2Info: {
    symbol: string,         // Token symbol (e.g., "USDC")
    name: string,           // Token name (e.g., "USDC")
    logoUrl: string,        // Token logo URL
    decimals: number        // Token decimals
  },
  feeAPR: string,           // Fee APR percentage
  farmAPR: string,          // Farm APR percentage
  dailyVolumeUSD: string,   // Daily trading volume in USD
  tvlUSD: string           // Total Value Locked in USD
}`}
              </pre>
              
              <p><strong>Transformed InvestmentData Structure:</strong></p>
              <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
{`{
  asset: string,            // "APT/USDC" (combined symbol)
  provider: string,         // "Hyperion"
  totalAPY: number,         // feeAPR + farmAPR
  depositApy: number,       // Same as totalAPY for DEX
  borrowAPY: number,        // 0 (no borrowing in DEX)
  token: string,            // poolId
  protocol: string,         // "Hyperion"
  dailyVolumeUSD: number,   // Daily volume in USD
  tvlUSD: number,          // TVL in USD
  token1Info: object,       // Full token1 info
  token2Info: object        // Full token2 info
}`}
              </pre>
            </div>
          </div>

          {filteredPools.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Sample Filtered Pool Data</h3>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                {JSON.stringify(filteredPools[0], null, 2)}
              </pre>
            </div>
          )}

          {filteredPools.length === 0 && hyperionPools.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 rounded">
              <h3 className="font-semibold text-yellow-800 mb-2">No pools match the filter</h3>
              <p className="text-sm text-yellow-700">
                No pools found with daily volume greater than {formatNumber(volumeThreshold)}. 
                Try lowering the threshold or check if the pools have volume data.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 