'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EchelonPool {
  asset: string;
  provider: string;
  totalAPY: number;
  depositApy: number;
  borrowAPY: number;
  token: string;
  protocol: string;
  poolType: string;
  tvlUSD: number;
  supplyCap: number;
  borrowCap: number;
  supplyRewardsApr: number;
  borrowRewardsApr: number;
  marketAddress: string;
  totalSupply: number;
  totalBorrow: number;
  stakingApr?: number;
  isStakingPool?: boolean;
  // APR breakdown fields
  lendingApr?: number;
  stakingAprOnly?: number;
  totalSupplyApr?: number;
  // LTV fields
  ltv?: number;
  lt?: number;
  emodeLtv?: number;
  emodeLt?: number;
}

export default function TestEchelonPoolsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pools, setPools] = useState<EchelonPool[]>([]);
  const [stats, setStats] = useState({
    totalPools: 0,
    uniqueAssets: 0,
    supplyOnly: 0,
    borrowOnly: 0,
    both: 0,
    stakingOnly: 0
  });

  const testEchelonPools = async () => {
    setLoading(true);
    setError(null);
    setPools([]);

    try {
      const response = await fetch('/api/protocols/echelon/v2/pools');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setPools(result.data);
        
        // Calculate statistics
        const uniqueAssets = new Set(result.data.map((pool: EchelonPool) => pool.asset));
        const supplyOnly = result.data.filter((pool: EchelonPool) => 
          pool.depositApy > 0 && pool.borrowAPY === 0
        ).length;
        const borrowOnly = result.data.filter((pool: EchelonPool) => 
          pool.depositApy === 0 && pool.borrowAPY > 0
        ).length;
        const both = result.data.filter((pool: EchelonPool) => 
          pool.depositApy > 0 && pool.borrowAPY > 0
        ).length;
        const stakingOnly = result.data.filter((pool: EchelonPool) => 
          pool.isStakingPool
        ).length;

        setStats({
          totalPools: result.data.length,
          uniqueAssets: uniqueAssets.size,
          supplyOnly,
          borrowOnly,
          both,
          stakingOnly
        });

      } else {
        setError(result.error || 'No data found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatAPR = (apr: number) => {
    if (apr === 0) return '-';
    return `${apr.toFixed(2)}%`;
  };

  const formatUSD = (amount: number) => {
    if (amount === 0) return '-';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getPoolTypeBadge = (pool: EchelonPool) => {
    if (pool.isStakingPool) {
      return <Badge variant="secondary">Staking</Badge>;
    }
    if (pool.depositApy > 0 && pool.borrowAPY > 0) {
      return <Badge variant="default">Supply + Borrow</Badge>;
    }
    if (pool.depositApy > 0) {
      return <Badge variant="outline">Supply Only</Badge>;
    }
    if (pool.borrowAPY > 0) {
      return <Badge variant="destructive">Borrow Only</Badge>;
    }
    return <Badge variant="secondary">Unknown</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
          E
        </div>
        <div>
          <h1 className="text-3xl font-bold">Test Echelon Pools</h1>
          <p className="text-muted-foreground">
            Test the updated Echelon pools API with combined Supply/Borrow pools
          </p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={testEchelonPools} disabled={loading}>
            {loading ? 'Loading...' : 'Test Echelon v2 Pools API'}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="p-4 border rounded-lg bg-red-50 border-red-200">
              <p className="text-red-600">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {pools.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Pool Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalPools}</div>
                  <div className="text-sm text-gray-600">Total Pools</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.uniqueAssets}</div>
                  <div className="text-sm text-gray-600">Unique Assets</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.both}</div>
                  <div className="text-sm text-gray-600">Supply + Borrow</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats.supplyOnly}</div>
                  <div className="text-sm text-gray-600">Supply Only</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{stats.borrowOnly}</div>
                  <div className="text-sm text-gray-600">Borrow Only</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{stats.stakingOnly}</div>
                  <div className="text-sm text-gray-600">Staking Only</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Echelon Pools ({pools.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Pool Type</TableHead>
                    <TableHead>Supply APR</TableHead>
                    <TableHead>Borrow APR</TableHead>
                    <TableHead>Staking APR</TableHead>
                    <TableHead>TVL</TableHead>
                    <TableHead>Market Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pools.map((pool, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{pool.asset}</TableCell>
                      <TableCell>{getPoolTypeBadge(pool)}</TableCell>
                      <TableCell className="text-green-600">
                        {pool.depositApy > 0 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">
                                  {formatAPR(pool.depositApy)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-black text-white border-gray-700 max-w-xs">
                                <div className="text-xs font-semibold mb-1">Supply APR Breakdown:</div>
                                <div className="space-y-1">
                                                                     {pool.lendingApr && pool.lendingApr > 0 && (
                                     <div className="flex justify-between">
                                       <span>Lending APR:</span>
                                       <span className="text-green-400">{pool.lendingApr.toFixed(2)}%</span>
                                     </div>
                                   )}
                                   {pool.stakingAprOnly && pool.stakingAprOnly > 0 && (
                                     <div className="flex justify-between">
                                       <span>Staking APR:</span>
                                       <span className="text-blue-400">{pool.stakingAprOnly.toFixed(2)}%</span>
                                     </div>
                                   )}
                                   {pool.supplyRewardsApr && pool.supplyRewardsApr > 0 && (
                                     <div className="flex justify-between">
                                       <span>Rewards APR:</span>
                                       <span className="text-yellow-400">{pool.supplyRewardsApr.toFixed(2)}%</span>
                                     </div>
                                   )}
                                                                     <div className="border-t border-gray-600 pt-1 mt-1">
                                     <div className="flex justify-between font-semibold">
                                       <span>Total:</span>
                                       <span className="text-white">{pool.depositApy.toFixed(2)}%</span>
                                     </div>
                                   </div>
                                   {/* LTV Information */}
                                   {pool.ltv && pool.ltv > 0 && (
                                     <div className="border-t border-gray-600 pt-1 mt-1">
                                       <div className="text-xs font-semibold mb-1 text-cyan-400">Collateral Info:</div>
                                       <div className="space-y-1">
                                         <div className="flex justify-between">
                                           <span>LTV:</span>
                                           <span className="text-cyan-400">{(pool.ltv * 100).toFixed(0)}%</span>
                                         </div>
                                         {pool.lt && pool.lt > 0 && (
                                           <div className="flex justify-between">
                                             <span>Liquidation Threshold:</span>
                                             <span className="text-orange-400">{(pool.lt * 100).toFixed(0)}%</span>
                                           </div>
                                         )}
                                         {pool.emodeLtv && pool.emodeLtv > 0 && (
                                           <div className="flex justify-between">
                                             <span>E-Mode LTV:</span>
                                             <span className="text-purple-400">{(pool.emodeLtv * 100).toFixed(0)}%</span>
                                           </div>
                                         )}
                                         {pool.emodeLt && pool.emodeLt > 0 && (
                                           <div className="flex justify-between">
                                             <span>E-Mode LT:</span>
                                             <span className="text-pink-400">{(pool.emodeLt * 100).toFixed(0)}%</span>
                                           </div>
                                         )}
                                       </div>
                                     </div>
                                   )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          formatAPR(pool.depositApy)
                        )}
                      </TableCell>
                      <TableCell className="text-red-600">
                        {formatAPR(pool.borrowAPY)}
                      </TableCell>
                      <TableCell className="text-blue-600">
                        {formatAPR(pool.stakingApr || 0)}
                      </TableCell>
                      <TableCell>{formatUSD(pool.tvlUSD)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {pool.marketAddress.slice(0, 8)}...{pool.marketAddress.slice(-6)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {pools.length === 0 && !loading && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Click "Test Echelon v2 Pools API" to load pools data</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
