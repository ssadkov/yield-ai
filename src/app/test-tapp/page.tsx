'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TappPool {
  pool_id: string;
  token_a: string;
  token_b: string;
  tvl: number;
  apr: number;
  fee_tier: number;
  volume_7d: number;
  poolType: string;
  tokens: Array<{
    addr: string;
    amount: number;
    img: string;
    reserve: number;
    symbol: string;
    verified: boolean;
  }>;
  volumeData: {
    volume24h: number;
    volume30d: number;
    volume7d: number;
    volumeprev24h: number;
  };
  createdAt: string;
  [key: string]: any; // For any additional fields
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
}

export default function TestTappPage() {
  const [pools, setPools] = useState<TappPool[]>([]);
  const [filteredPools, setFilteredPools] = useState<TappPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 50, total: 0 });
  
  // Filter states
  const [minApr, setMinApr] = useState<number>(0);
  const [minTvl, setMinTvl] = useState<number>(0);
  const [poolTypeFilter, setPoolTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('apr');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchTappPools = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/protocols/tapp/pools?chain=aptos&page=${pagination.page}&limit=${pagination.limit}`);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Tapp pools API response:', data);
      
      if (data.success && Array.isArray(data.data)) {
        setPools(data.data);
        setFilteredPools(data.data);
        setPagination(data.pagination || { page: 1, limit: 50, total: data.data.length });
      } else {
        console.log('No valid pools data');
        setPools([]);
        setFilteredPools([]);
      }
    } catch (err) {
      console.error('Error fetching Tapp pools:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPools([]);
      setFilteredPools([]);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...pools];
    
    // Apply APR filter
    if (minApr > 0) {
      filtered = filtered.filter(pool => pool.apr >= minApr);
    }
    
    // Apply TVL filter
    if (minTvl > 0) {
      filtered = filtered.filter(pool => pool.tvl >= minTvl);
    }
    
    // Apply pool type filter
    if (poolTypeFilter !== 'all') {
      filtered = filtered.filter(pool => pool.poolType === poolTypeFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
    
    setFilteredPools(filtered);
  }, [pools, minApr, minTvl, poolTypeFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchTappPools();
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
      case 'CLMM':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'AMM':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'STABLE':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Test Tapp Exchange Pools</h1>
        <p className="text-muted-foreground">
          Test Tapp Exchange pools integration and see the transformation from raw data
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
              onClick={fetchTappPools} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Loading...' : 'Refresh Pools'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              <Label htmlFor="poolType">Pool Type</Label>
              <Select value={poolTypeFilter} onValueChange={setPoolTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CLMM">CLMM</SelectItem>
                  <SelectItem value="AMM">AMM</SelectItem>
                  <SelectItem value="STABLE">Stable</SelectItem>
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
                  <SelectItem value="volume_7d">7d Volume</SelectItem>
                  <SelectItem value="fee_tier">Fee Tier</SelectItem>
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
                 {formatCurrency(filteredPools.reduce((sum, pool) => sum + (pool.volumeData?.volume24h || 0), 0))}
               </div>
               <div className="text-sm text-muted-foreground">Total 24h Volume</div>
             </div>
             <div className="text-center">
               <div className="text-2xl font-bold">
                 {filteredPools.filter(pool => pool.poolType === 'CLMM').length}
               </div>
               <div className="text-sm text-muted-foreground">CLMM Pools</div>
             </div>
             <div className="text-center">
               <div className="text-2xl font-bold">
                 {filteredPools.filter(pool => pool.poolType === 'AMM').length}
               </div>
               <div className="text-sm text-muted-foreground">AMM Pools</div>
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
            Tapp Exchange Pools ({filteredPools.length} pools)
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
                         {pool.tokens && pool.tokens.length >= 2 && (
                           <div className="flex -space-x-2">
                             <img 
                               src={pool.tokens[0].img} 
                               alt={pool.tokens[0].symbol} 
                               className="w-8 h-8 rounded-full border-2 border-white object-contain"
                               onError={(e) => {
                                 e.currentTarget.style.display = 'none';
                               }}
                             />
                             <img 
                               src={pool.tokens[1].img} 
                               alt={pool.tokens[1].symbol} 
                               className="w-8 h-8 rounded-full border-2 border-white object-contain"
                               onError={(e) => {
                                 e.currentTarget.style.display = 'none';
                               }}
                             />
                           </div>
                         )}
                         <div>
                           <div className="font-semibold text-lg">
                             {pool.token_a} / {pool.token_b}
                           </div>
                           <div className="flex items-center gap-2">
                             <Badge className={getPoolTypeColor(pool.poolType)}>
                               {pool.poolType}
                             </Badge>
                             <span className="text-sm text-muted-foreground">
                               ID: {pool.pool_id?.substring(0, 8)}...
                             </span>
                           </div>
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
                         <div className="font-semibold">{formatCurrency(pool.volumeData?.volume24h || 0)}</div>
                       </div>
                       
                       <div className="text-right">
                         <div className="text-sm text-muted-foreground">Fee Tier</div>
                         <div className="font-semibold">{formatPercentage(pool.fee_tier)}</div>
                       </div>
                       
                       <div className="text-right">
                         <div className="text-sm text-muted-foreground">APR</div>
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
            {JSON.stringify({ pools: filteredPools, pagination }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
} 