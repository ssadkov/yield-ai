'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface MarketAsset {
  address: string;
  faAddress?: string; // Optional faAddress for some tokens
  symbol: string;
  name: string;
  price: number;
  supplyApr: number;
  borrowApr: number;
  market: string;
  supplyCap: number;
  borrowCap: number;
}

interface MarketStats {
  address: string;
  totalSupply: number;
  totalBorrow: number;
}

interface MarketsData {
  assets: MarketAsset[];
  marketStats: MarketStats[];
}

interface TableRowData {
  symbol: string;
  name: string;
  price: number;
  supplyApr: number;
  borrowApr: number;
  totalSupply: number;
  totalBorrow: number;
  supplyCap: number;
  borrowCap: number;
  supplyRewardsApr: number;
  supplyRewardTokens: string[];
  borrowRewardsApr: number;
  borrowRewardTokens: string[];
  totalSupplyApr: number;
  totalBorrowApr: number;
}

type RewardCoin = {
  symbol: string;
  price: number;
  rewardPerSec: number;
  totalAllocPoint: number;
  endTime?: number; // Unix timestamp when rewards end
};

type PoolRewardInfo = {
  stakeAmount: number;
  rewards: {
    rewardKey: string;
    allocPoint: number;
  }[];
};

function calculateRewardsApr(
  pool: PoolRewardInfo,
  assetPrice: number,
  rewardCoins: Record<string, RewardCoin>
): number {
  const SECONDS_IN_YEAR = 31_536_000;
  const currentTime = Math.floor(Date.now() / 1000); // Current Unix timestamp

  let totalApr = 0;

  for (const reward of pool.rewards) {
    const rewardData = rewardCoins[reward.rewardKey];
    if (!rewardData || reward.allocPoint === 0 || pool.stakeAmount === 0) continue;

    // Check if rewards have ended
    if (rewardData.endTime && rewardData.endTime <= currentTime) {
      continue; // Skip expired rewards
    }

    const rewardPerSecForPool =
      (rewardData.rewardPerSec * reward.allocPoint) / rewardData.totalAllocPoint;

    const annualRewardUSD = rewardPerSecForPool * SECONDS_IN_YEAR * rewardData.price;

    const tvlUSD = pool.stakeAmount * assetPrice;

    const apr = annualRewardUSD / tvlUSD;

    totalApr += apr;
  }

  return totalApr;
}

export default function TestEchelonNewPage() {
  const [address, setAddress] = useState('');
  const [data, setData] = useState<any>(null);
  const [marketsData, setMarketsData] = useState<MarketsData | null>(null);
  const [tableData, setTableData] = useState<TableRowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [marketsLoading, setMarketsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testUserPositions = async () => {
    if (!address) {
      setError('Please enter an address');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`/api/protocols/echelon/userPositions?address=${address}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testAccountCollateralMarkets = async () => {
    if (!address) {
      setError('Please enter an address');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`/api/protocols/echelon/account-collateral-markets?address=${address}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getMarkets = async () => {
    setMarketsLoading(true);
    setError(null);
    setMarketsData(null);
    setTableData([]);

    try {
      const response = await fetch('/api/protocols/echelon/markets');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setMarketsData(result.data);
        
        
        // Process data for table
        const processedData: TableRowData[] = [];
        
        // Check if we have assets and marketStats
        if (!result.data.assets || !Array.isArray(result.data.assets)) {
          setError('No assets data found');
          return;
        }
        
        if (!result.data.marketStats || !Array.isArray(result.data.marketStats)) {
          setError('No market stats data found');
          return;
        }
        
        // Create a map of market stats for quick lookup
        const marketStatsMap = new Map<string, any>();
        
        // Handle marketStats as array of [marketAddress, stats] pairs
        if (Array.isArray(result.data.marketStats)) {
          result.data.marketStats.forEach((item: any) => {
            if (Array.isArray(item) && item.length === 2) {
              const [marketAddress, stats] = item;
              marketStatsMap.set(marketAddress, {
                totalShares: stats.totalShares || 0,
                totalLiability: stats.totalLiability || 0,
                totalReserve: stats.totalReserve || 0,
                totalCash: stats.totalCash || 0,
              });
            }
          });
        }
        
        // Create maps for farming data
        const supplyPoolsMap = new Map<string, PoolRewardInfo>();
        const borrowPoolsMap = new Map<string, PoolRewardInfo>();
        const rewardCoinsMap: Record<string, RewardCoin> = {};

        // Process farming data
        if (result.data.farming) {
          // Process reward coins
          if (result.data.farming.rewards) {
            result.data.farming.rewards.forEach((rewardItem: any) => {
              if (Array.isArray(rewardItem) && rewardItem.length === 2) {
                const [rewardKey, rewardData] = rewardItem;
                rewardCoinsMap[rewardKey] = {
                  symbol: rewardData.rewardCoin.symbol,
                  price: rewardData.rewardCoin.price,
                  rewardPerSec: rewardData.rewardPerSec,
                  totalAllocPoint: rewardData.totalAllocPoint,
                  endTime: rewardData.endTime, // Include endTime if available
                };
              }
            });
          }

          // Process supply pools
          if (result.data.farming.pools?.supply) {
            result.data.farming.pools.supply.forEach((poolItem: any) => {
              if (Array.isArray(poolItem) && poolItem.length === 2) {
                const [marketAddress, poolData] = poolItem;
                supplyPoolsMap.set(marketAddress, {
                  stakeAmount: poolData.stakeAmount,
                  rewards: poolData.rewards || [],
                });
              }
            });
          }

          // Process borrow pools
          if (result.data.farming.pools?.borrow) {
            result.data.farming.pools.borrow.forEach((poolItem: any) => {
              if (Array.isArray(poolItem) && poolItem.length === 2) {
                const [marketAddress, poolData] = poolItem;
                borrowPoolsMap.set(marketAddress, {
                  stakeAmount: poolData.stakeAmount,
                  rewards: poolData.rewards || [],
                });
              }
            });
          }
        }

        
        // Filter and process assets
        result.data.assets.forEach((asset: any) => {
          
          // Get market stats for this asset by token address (not market address)
          // Try address first, then faAddress if available
          let marketStat = marketStatsMap.get(asset.address);
          if (!marketStat && asset.faAddress) {
            marketStat = marketStatsMap.get(asset.faAddress);
          }
          
          if (!marketStat) {
            return; // Skip if no market stats available
          }
          
          // Skip tokens where both supplyCap and borrowCap are 0 AND no activity
          const hasActivity = marketStat.totalShares > 0 || marketStat.totalLiability > 0;
          if (asset.supplyCap === 0 && asset.borrowCap === 0 && !hasActivity) {
            return;
          }
          
          
          // Calculate rewards APR for both supply and borrow
          const supplyPool = supplyPoolsMap.get(asset.market);
          const borrowPool = borrowPoolsMap.get(asset.market);
          
          let supplyRewardsApr = 0;
          let borrowRewardsApr = 0;
          const supplyRewardTokens: string[] = [];
          const borrowRewardTokens: string[] = [];
          
          // Calculate supply rewards
          if (supplyPool && supplyPool.rewards.length > 0) {
            supplyRewardsApr = calculateRewardsApr(supplyPool, asset.price || 0, rewardCoinsMap);
            supplyPool.rewards.forEach((reward: any) => {
              if (reward.allocPoint > 0) {
                supplyRewardTokens.push(reward.rewardKey);
              }
            });
          }
          
          // Calculate borrow rewards
          if (borrowPool && borrowPool.rewards.length > 0) {
            borrowRewardsApr = calculateRewardsApr(borrowPool, asset.price || 0, rewardCoinsMap);
            borrowPool.rewards.forEach((reward: any) => {
              if (reward.allocPoint > 0) {
                borrowRewardTokens.push(reward.rewardKey);
              }
            });
          }
          
          // Calculate total APRs (base + rewards)
          const totalSupplyApr = (asset.supplyApr || 0) * 100 + supplyRewardsApr * 100;
          const totalBorrowApr = (asset.borrowApr || 0) * 100 + borrowRewardsApr * 100;
          
          
                      processedData.push({
              symbol: asset.symbol || 'Unknown',
              name: asset.name || 'Unknown',
              price: asset.price || 0,
              supplyApr: (asset.supplyApr || 0) * 100, // Convert to percentage
              borrowApr: (asset.borrowApr || 0) * 100, // Convert to percentage
              totalSupply: marketStat.totalShares, // Use totalShares from marketStats
              totalBorrow: marketStat.totalLiability, // Use totalLiability from marketStats
              supplyCap: asset.supplyCap || 0,
              borrowCap: asset.borrowCap || 0,
              supplyRewardsApr: supplyRewardsApr * 100, // Convert to percentage
              supplyRewardTokens: supplyRewardTokens,
              borrowRewardsApr: borrowRewardsApr * 100, // Convert to percentage
              borrowRewardTokens: borrowRewardTokens,
              totalSupplyApr: totalSupplyApr,
              totalBorrowApr: totalBorrowApr,
            });
        });
        
        
        // Sort by totalSupply in descending order
        processedData.sort((a, b) => b.totalSupply - a.totalSupply);
        
        
        setTableData(processedData);
      } else {
        setError(result.error || 'Invalid data format received');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setMarketsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Test Echelon New API</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address">Wallet Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Aptos wallet address"
            />
          </div>
          
          <div className="flex gap-4 flex-wrap">
            <Button onClick={testUserPositions} disabled={loading}>
              Test userPositions API
            </Button>
            <Button onClick={testAccountCollateralMarkets} disabled={loading}>
              Test account-collateral-markets API
            </Button>
            <Button onClick={getMarkets} disabled={marketsLoading} variant="outline">
              Get Markets (Proxy)
            </Button>
          </div>
        </CardContent>
      </Card>

      {marketsLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">Loading markets data...</div>
          </CardContent>
        </Card>
      )}

      {tableData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Echelon Markets Data ({tableData.length} active markets)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Supply APR (%)</TableHead>
                    <TableHead>Borrow APR (%)</TableHead>
                    <TableHead>Total Supply APR (%)</TableHead>
                    <TableHead>Total Borrow APR (%)</TableHead>
                    <TableHead>Total Supply</TableHead>
                    <TableHead>Total Borrow</TableHead>
                    <TableHead>Supply Cap</TableHead>
                    <TableHead>Borrow Cap</TableHead>
                    <TableHead>Supply Rewards APR (%)</TableHead>
                    <TableHead>Supply Reward Tokens</TableHead>
                    <TableHead>Borrow Rewards APR (%)</TableHead>
                    <TableHead>Borrow Reward Tokens</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.symbol}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>${row.price.toFixed(4)}</TableCell>
                      <TableCell>{row.supplyApr.toFixed(2)}%</TableCell>
                      <TableCell>{row.borrowApr.toFixed(2)}%</TableCell>
                      <TableCell>{row.totalSupplyApr.toFixed(2)}%</TableCell>
                      <TableCell>{row.totalBorrowApr.toFixed(2)}%</TableCell>
                      <TableCell>{row.totalSupply.toLocaleString()}</TableCell>
                      <TableCell>{row.totalBorrow.toLocaleString()}</TableCell>
                      <TableCell>{row.supplyCap?.toLocaleString() || 'N/A'}</TableCell>
                      <TableCell>{row.borrowCap?.toLocaleString() || 'N/A'}</TableCell>
                      <TableCell>{row.supplyRewardsApr > 0 ? `${row.supplyRewardsApr.toFixed(2)}%` : 'N/A'}</TableCell>
                      <TableCell>{row.supplyRewardTokens.length > 0 ? row.supplyRewardTokens.join(', ') : 'N/A'}</TableCell>
                      <TableCell>{row.borrowRewardsApr > 0 ? `${row.borrowRewardsApr.toFixed(2)}%` : 'N/A'}</TableCell>
                      <TableCell>{row.borrowRewardTokens.length > 0 ? row.borrowRewardTokens.join(', ') : 'N/A'}</TableCell>
                      <TableCell>
                        {row.supplyCap > 0 && row.borrowCap > 0 ? 'Supply & Borrow' : 
                         row.supplyCap > 0 ? 'Supply Only' : 
                         row.borrowCap > 0 ? 'Borrow Only' : 'No Caps'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {marketsData && tableData.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-yellow-600">Data Loaded but No Active Markets Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Data was loaded successfully, but no active markets were found after filtering.</p>
            <p>Check the console for detailed processing information.</p>
          </CardContent>
        </Card>
      )}

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

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>API Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm overflow-auto max-h-96 bg-gray-100 p-4 rounded">
              {JSON.stringify(data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {marketsData && (
        <Card>
          <CardHeader>
            <CardTitle>Raw Markets Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm overflow-auto max-h-96 bg-gray-100 p-4 rounded">
              {JSON.stringify(marketsData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 