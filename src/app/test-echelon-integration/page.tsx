'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { InvestmentData } from '@/types/investments';

export default function TestEchelonIntegrationPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pools, setPools] = useState<InvestmentData[]>([]);
  const [allPools, setAllPools] = useState<InvestmentData[]>([]);

  const testEchelonAPI = async () => {
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
      } else {
        setError(result.error || 'No data found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testAllPools = async () => {
    setLoading(true);
    setError(null);
    setAllPools([]);

    try {
      const response = await fetch('/api/aptos/pools');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.data) {
        setAllPools(result.data);
        
        // Filter Echelon pools
        const echelonPools = result.data.filter((pool: InvestmentData) => pool.protocol === 'Echelon');
      } else {
        setError('No data found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Test Echelon Integration</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Button onClick={testEchelonAPI} disabled={loading}>
              {loading ? 'Loading...' : 'Test Echelon v2 API'}
            </Button>
            <Button onClick={testAllPools} disabled={loading} variant="outline">
              {loading ? 'Loading...' : 'Test All Pools Integration'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-red-600">{error}</pre>
          </CardContent>
        </Card>
      )}

      {pools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Echelon v2 API Results ({pools.length} pools)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pools.slice(0, 10).map((pool, index) => (
                <div key={index} className="border p-4 rounded-lg">
                                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                     <div>
                       <strong>Asset:</strong> {pool.asset || 'N/A'}
                     </div>
                     <div>
                       <strong>Total APR:</strong> {pool.totalAPY ? pool.totalAPY.toFixed(2) : '0'}%
                     </div>
                     <div>
                       <strong>Deposit APR:</strong> {pool.depositApy ? (
                         <TooltipProvider>
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <span className="cursor-help">
                                 {pool.depositApy.toFixed(2)}%
                               </span>
                             </TooltipTrigger>
                             <TooltipContent className="bg-black text-white border-gray-700 max-w-xs">
                               <div className="text-xs font-semibold mb-1">Supply APR Breakdown:</div>
                               <div className="space-y-1">
                                 {pool.depositApy && pool.depositApy > 0 && (
                                   <div className="flex justify-between">
                                     <span>Deposit APR:</span>
                                     <span className="text-green-400">{pool.depositApy.toFixed(2)}%</span>
                                   </div>
                                 )}
                                 {pool.stakingApr && pool.stakingApr > 0 && (
                                   <div className="flex justify-between">
                                     <span>Staking APR:</span>
                                     <span className="text-blue-400">{pool.stakingApr.toFixed(2)}%</span>
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
                                 {/* Note: LTV fields not available in current InvestmentData type */}
                                 <div className="text-xs text-gray-400 mt-2">
                                   LTV data not available in current API response
                                 </div>
                               </div>
                             </TooltipContent>
                           </Tooltip>
                         </TooltipProvider>
                       ) : '0'}%
                     </div>
                     <div>
                       <strong>Borrow APR:</strong> {pool.borrowAPY ? pool.borrowAPY.toFixed(2) : '0'}%
                     </div>
                     <div>
                       <strong>TVL:</strong> ${pool.tvlUSD ? pool.tvlUSD.toLocaleString() : 'N/A'}
                     </div>
                     <div>
                       <strong>Protocol:</strong> {pool.protocol || 'N/A'}
                     </div>
                     <div>
                       <strong>Pool Type:</strong> {pool.poolType || 'N/A'}
                     </div>
                     <div>
                       <strong>Token:</strong> {pool.token ? pool.token.slice(0, 20) + '...' : 'N/A'}
                     </div>
                   </div>
                  {pool.supplyRewardsApr && (
                    <div className="mt-2 text-xs text-gray-600">
                      Supply Rewards: {pool.supplyRewardsApr.toFixed(2)}% | 
                      Borrow Rewards: {pool.borrowRewardsApr?.toFixed(2) || '0'}%
                    </div>
                  )}
                </div>
              ))}
              {pools.length > 10 && (
                <div className="text-center text-gray-500">
                  Showing first 10 pools of {pools.length} total
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {allPools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Pools Integration Results ({allPools.length} total pools)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm">
                <strong>Protocols found:</strong>
                {Object.entries(
                  allPools.reduce((acc, pool) => {
                    acc[pool.protocol] = (acc[pool.protocol] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([protocol, count]) => (
                  <span key={protocol} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2 mb-2">
                    {protocol}: {count}
                  </span>
                ))}
              </div>
              
              <div className="text-sm">
                <strong>Echelon pools in all pools:</strong>
                                   {allPools
                     .filter(pool => pool.protocol === 'Echelon')
                     .slice(0, 5)
                     .map((pool, index) => (
                       <div key={index} className="border p-2 rounded mt-2">
                         {pool.asset || 'N/A'} - {pool.totalAPY ? pool.totalAPY.toFixed(2) : '0'}% APR
                       </div>
                     ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 