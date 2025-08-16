'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InvestmentData } from '@/types/investments';

export default function TestKoFiPoolsPage() {
  const [pools, setPools] = useState<InvestmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<any>(null);

  const fetchKoFiPools = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching KoFi Finance pools...');
      const response = await fetch('/api/protocols/kofi/pools');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('KoFi Finance API response:', data);
      
      setRawData(data);
      setPools(data.data || []);
      
    } catch (err) {
      console.error('Error fetching KoFi Finance pools:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKoFiPools();
  }, []);

  const formatAPY = (apy: number) => {
    return `${apy.toFixed(2)}%`;
  };

  const formatUSD = (amount: number) => {
    if (amount >= 1e6) {
      return `$${(amount / 1e6).toFixed(2)}M`;
    } else if (amount >= 1e3) {
      return `$${(amount / 1e3).toFixed(2)}K`;
    } else {
      return `$${amount.toFixed(2)}`;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1e6) {
      return `${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(2)}K`;
    } else {
      return num.toFixed(2);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Testing KoFi Finance Pools Integration</h1>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Testing KoFi Finance Pools Integration</h1>
          <p className="text-muted-foreground">
            Testing the integration of KoFi Finance staking pools from Echelon API
          </p>
        </div>
        <Button onClick={fetchKoFiPools} variant="outline">
          Refresh Data
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {pools.length === 0 && !error && (
        <Card>
          <CardHeader>
            <CardTitle>No Pools Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>No KoFi Finance pools were found. This might indicate an issue with the API or data.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {pools.map((pool, index) => (
          <Card key={index} className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{pool.asset}</CardTitle>
                  <CardDescription>
                    {pool.protocol} • {pool.poolType}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {formatAPY(pool.totalAPY)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total APY</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Provider</div>
                  <div className="font-semibold">{pool.provider}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Token</div>
                  <div className="font-mono text-sm">{pool.token}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">TVL</div>
                  <div className="font-semibold">{formatUSD(pool.tvlUSD || 0)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Total Supply</div>
                  <div className="font-semibold">{formatNumber(pool.totalSupply || 0)}</div>
                </div>
              </div>

              {pool.isStakingPool && (
                <div className="border-t pt-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Staking Details</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Staking Token</div>
                      <Badge variant="secondary">{pool.stakingToken}</Badge>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Underlying Token</div>
                      <Badge variant="outline">{pool.underlyingToken}</Badge>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Staking APR</div>
                      <div className="font-semibold text-green-600">
                        {formatAPY(pool.stakingApr || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Supply Cap</div>
                      <div className="font-semibold">{formatNumber(pool.supplyCap || 0)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="text-sm font-medium text-muted-foreground mb-2">Raw Pool Data</div>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                  {JSON.stringify(pool, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rawData && (
        <Card>
          <CardHeader>
            <CardTitle>Raw API Response</CardTitle>
            <CardDescription>Complete response from KoFi Finance API</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(rawData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
