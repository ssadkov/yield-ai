'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InvestmentData {
  asset: string;
  provider: string;
  totalAPY: number;
  depositApy: number;
  borrowAPY: number;
  token: string;
  protocol: string;
  dailyVolumeUSD?: number;
  tvlUSD?: number;
  token1Info?: any;
  token2Info?: any;
  poolType?: string;
  feeTier?: number;
  volume7d?: number;
}

export default function TestIntegrationPage() {
  const [allPools, setAllPools] = useState<InvestmentData[]>([]);
  const [filteredPools, setFilteredPools] = useState<InvestmentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volumeThreshold, setVolumeThreshold] = useState(1000);
  const [protocolFilter, setProtocolFilter] = useState('all');

  const fetchAllPools = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/aptos/pools');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      setAllPools(data.data || []);
      
      console.log('All pools:', data.data);
      console.log('Protocols:', data.protocols);
      
    } catch (error) {
      console.error('Error fetching pools:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...allPools];
    
    // Apply volume filter
    filtered = filtered.filter(pool => {
      const volume = pool.dailyVolumeUSD || 0;
      return volume >= volumeThreshold;
    });
    
    // Apply protocol filter
    if (protocolFilter !== 'all') {
      filtered = filtered.filter(pool => pool.protocol === protocolFilter);
    }
    
    setFilteredPools(filtered);
  }, [allPools, volumeThreshold, protocolFilter]);

  useEffect(() => {
    fetchAllPools();
  }, []);

  const formatCurrency = (value: number) => {
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getProtocolStats = () => {
    const stats: Record<string, { count: number; totalVolume: number; avgAPY: number }> = {};
    
    filteredPools.forEach(pool => {
      if (!stats[pool.protocol]) {
        stats[pool.protocol] = { count: 0, totalVolume: 0, avgAPY: 0 };
      }
      stats[pool.protocol].count++;
      stats[pool.protocol].totalVolume += pool.dailyVolumeUSD || 0;
      stats[pool.protocol].avgAPY += pool.totalAPY;
    });
    
    // Calculate averages
    Object.keys(stats).forEach(protocol => {
      if (stats[protocol].count > 0) {
        stats[protocol].avgAPY /= stats[protocol].count;
      }
    });
    
    return stats;
  };

  const protocolStats = getProtocolStats();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Test Integration - Investment Ideas</h1>
        <p className="text-muted-foreground">
          Testing Tapp Exchange integration with volume filter &gt; $1000/day
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={fetchAllPools} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Loading...' : 'Refresh Pools'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="volumeThreshold">Min Daily Volume ($)</Label>
              <Input
                id="volumeThreshold"
                type="number"
                step="100"
                value={volumeThreshold}
                onChange={(e) => setVolumeThreshold(parseFloat(e.target.value) || 0)}
                placeholder="1000"
              />
            </div>
            
            <div>
              <Label htmlFor="protocolFilter">Protocol</Label>
              <select
                id="protocolFilter"
                value={protocolFilter}
                onChange={(e) => setProtocolFilter(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="all">All Protocols</option>
                <option value="Hyperion">Hyperion</option>
                <option value="Tapp Exchange">Tapp Exchange</option>
                <option value="Echelon">Echelon</option>
                <option value="Joule">Joule</option>
                <option value="Aries">Aries</option>
                <option value="Meso Finance">Meso Finance</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-red-600 font-medium">Error: {error}</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{filteredPools.length}</div>
              <div className="text-sm text-muted-foreground">Total Pools</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {filteredPools.length > 0 
                  ? formatPercentage(filteredPools.reduce((sum, pool) => sum + pool.totalAPY, 0) / filteredPools.length)
                  : '0%'
                }
              </div>
              <div className="text-sm text-muted-foreground">Average APY</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatCurrency(filteredPools.reduce((sum, pool) => sum + (pool.dailyVolumeUSD || 0), 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total Daily Volume</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatCurrency(filteredPools.reduce((sum, pool) => sum + (pool.tvlUSD || 0), 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total TVL</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Protocol Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(protocolStats).map(([protocol, stats]) => (
              <div key={protocol} className="p-4 border rounded">
                <div className="font-semibold text-lg">{protocol}</div>
                <div className="text-sm space-y-1">
                  <div>Pools: {stats.count}</div>
                  <div>Avg APY: {formatPercentage(stats.avgAPY)}</div>
                  <div>Daily Volume: {formatCurrency(stats.totalVolume)}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtered Pools ({filteredPools.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredPools.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pools found with current filters
              </div>
            ) : (
              filteredPools
                .sort((a, b) => b.totalAPY - a.totalAPY)
                .map((pool, index) => (
                  <div key={index} className="p-4 border rounded hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-lg">{pool.asset}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{pool.protocol}</Badge>
                          {pool.poolType && (
                            <Badge variant="secondary">{pool.poolType}</Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {formatPercentage(pool.totalAPY)}
                        </div>
                        <div className="text-sm text-muted-foreground">APY</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Daily Volume</div>
                        <div className="font-semibold">{formatCurrency(pool.dailyVolumeUSD || 0)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">TVL</div>
                        <div className="font-semibold">{formatCurrency(pool.tvlUSD || 0)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Provider</div>
                        <div className="font-semibold">{pool.provider}</div>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 