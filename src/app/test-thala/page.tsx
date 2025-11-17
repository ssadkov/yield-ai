'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ThalaPool {
  pool_id: string;
  token_a: string;
  token_b: string;
  tvl: number;
  apr: number;
  poolType: string;
  volume1d: number;
  fees1d: number;
  swapFee: number;
  aprSources: Array<{
    source: string;
    apr: number;
  }>;
  stakeRatio: number;
  balances: number[];
  coinAddresses: string[];
  metadata?: any;
  [key: string]: any;
}

export default function TestThalaPage() {
  const [pools, setPools] = useState<ThalaPool[]>([]);
  const [filteredPools, setFilteredPools] = useState<ThalaPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [minApr, setMinApr] = useState<number>(0);
  const [minTvl, setMinTvl] = useState<number>(0);
  const [minVolume, setMinVolume] = useState<number>(1000); // Default filter like in InvestmentsDashboard
  const [poolTypeFilter, setPoolTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('apr');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchThalaPools = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/protocols/thala/pools');
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Thala pools API response:', data);
      
      if (data.success && Array.isArray(data.data)) {
        setPools(data.data);
        setFilteredPools(data.data);
      } else {
        console.log('No valid pools data');
        setPools([]);
        setFilteredPools([]);
      }
    } catch (err) {
      console.error('Error fetching Thala pools:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPools([]);
      setFilteredPools([]);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters, search, and sorting
  useEffect(() => {
    let filtered = [...pools];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pool => 
        pool.token_a.toLowerCase().includes(query) ||
        pool.token_b.toLowerCase().includes(query) ||
        `${pool.token_a}/${pool.token_b}`.toLowerCase().includes(query)
      );
    }
    
    // Apply APR filter
    if (minApr > 0) {
      filtered = filtered.filter(pool => pool.apr >= minApr / 100); // Convert percentage to decimal
    }
    
    // Apply TVL filter
    if (minTvl > 0) {
      filtered = filtered.filter(pool => pool.tvl >= minTvl);
    }
    
    // Apply daily volume filter (default: 1000, same as InvestmentsDashboard)
    if (minVolume > 0) {
      filtered = filtered.filter(pool => pool.volume1d >= minVolume);
    }
    
    // Apply pool type filter
    if (poolTypeFilter !== 'all') {
      filtered = filtered.filter(pool => pool.poolType === poolTypeFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number;
      let bValue: number;
      
      switch (sortBy) {
        case 'apr':
          aValue = a.apr || 0;
          bValue = b.apr || 0;
          break;
        case 'tvl':
          aValue = a.tvl || 0;
          bValue = b.tvl || 0;
          break;
        case 'volume1d':
          aValue = a.volume1d || 0;
          bValue = b.volume1d || 0;
          break;
        case 'fees1d':
          aValue = a.fees1d || 0;
          bValue = b.fees1d || 0;
          break;
        default:
          aValue = a.apr || 0;
          bValue = b.apr || 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
    
    setFilteredPools(filtered);
  }, [pools, minApr, minTvl, minVolume, poolTypeFilter, sortBy, sortOrder, searchQuery]);

  useEffect(() => {
    fetchThalaPools();
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
    return `${(value * 100).toFixed(2)}%`;
  };

  const getAprColor = (apr: number) => {
    if (apr >= 0.2) return 'bg-green-500/10 text-green-600 border-green-500/20';
    if (apr >= 0.1) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  };

  const getPoolTypeColor = (poolType: string) => {
    switch (poolType) {
      case 'Stable':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'Concentrated':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Test Thala Protocol Pools</h1>
        <p className="text-muted-foreground">
          Test Thala protocol pools integration and see the transformation from raw data
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={fetchThalaPools} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Loading...' : 'Refresh Pools'}
            </Button>
          </div>

          {/* Search */}
          <div>
            <Label htmlFor="search">Search Pools</Label>
            <Input
              id="search"
              type="text"
              placeholder="Search by token symbols..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="minApr">Min APR (%)</Label>
              <Input
                id="minApr"
                type="number"
                step="0.1"
                value={minApr}
                onChange={(e) => setMinApr(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            
            <div>
              <Label htmlFor="minTvl">Min TVL ($)</Label>
              <Input
                id="minTvl"
                type="number"
                step="1000"
                value={minTvl}
                onChange={(e) => setMinTvl(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            
            <div>
              <Label htmlFor="minVolume">Min 24h Volume ($)</Label>
              <Input
                id="minVolume"
                type="number"
                step="1000"
                value={minVolume}
                onChange={(e) => setMinVolume(parseFloat(e.target.value) || 0)}
                placeholder="1000"
              />
            </div>
            
            <div>
              <Label htmlFor="poolType">Pool Type</Label>
              <Select value={poolTypeFilter} onValueChange={setPoolTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Stable">Stable</SelectItem>
                  <SelectItem value="Concentrated">Concentrated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="sortBy">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apr">APR</SelectItem>
                  <SelectItem value="tvl">TVL</SelectItem>
                  <SelectItem value="volume1d">24h Volume</SelectItem>
                  <SelectItem value="fees1d">24h Fees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{filteredPools.length}</div>
              <div className="text-sm text-muted-foreground">Total Pools</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {filteredPools.length > 0 
                  ? formatPercentage(filteredPools.reduce((sum, pool) => sum + pool.apr, 0) / filteredPools.length)
                  : '0%'
                }
              </div>
              <div className="text-sm text-muted-foreground">Average APR</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatCurrency(filteredPools.reduce((sum, pool) => sum + pool.tvl, 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total TVL</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatCurrency(filteredPools.reduce((sum, pool) => sum + pool.volume1d, 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total 24h Volume</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {filteredPools.filter(pool => pool.poolType === 'Stable').length}
              </div>
              <div className="text-sm text-muted-foreground">Stable Pools</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {filteredPools.filter(pool => pool.poolType === 'Concentrated').length}
              </div>
              <div className="text-sm text-muted-foreground">Concentrated Pools</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-red-600 font-medium">Error: {error}</div>
          </CardContent>
        </Card>
      )}

      {/* Pools List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Thala Protocol Pools ({filteredPools.length} pools)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading pools...</div>
          ) : filteredPools.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pools found matching the criteria
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPools.map((pool, index) => (
                <Card key={pool.pool_id || index} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-semibold text-lg">
                            {pool.token_a} / {pool.token_b}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getPoolTypeColor(pool.poolType)}>
                              {pool.poolType}
                            </Badge>
                            {pool.stakeRatio > 0 && (
                              <Badge variant="outline">
                                Staked: {formatPercentage(pool.stakeRatio)}
                              </Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              Fee: {formatPercentage(pool.swapFee)}
                            </span>
                          </div>
                          {pool.aprSources && pool.aprSources.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {pool.aprSources.map((source, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {source.source}: {formatPercentage(source.apr)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">TVL</div>
                        <div className="font-semibold">{formatCurrency(pool.tvl)}</div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">24h Volume</div>
                        <div className="font-semibold">{formatCurrency(pool.volume1d)}</div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">24h Fees</div>
                        <div className="font-semibold">{formatCurrency(pool.fees1d)}</div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Total APR</div>
                        <Badge className={getAprColor(pool.apr)}>
                          {formatPercentage(pool.apr)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Raw Data */}
      <Card>
        <CardHeader>
          <CardTitle>Raw API Response</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify({ pools: filteredPools }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

