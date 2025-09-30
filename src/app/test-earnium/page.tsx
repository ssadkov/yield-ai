'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import tokenList from '@/lib/data/tokenList.json';

export default function TestEarniumPage() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [poolBalances, setPoolBalances] = useState<Record<number, any[]>>({});
  const [balancesLoading, setBalancesLoading] = useState<Record<number, boolean>>({});
  const [pools, setPools] = useState<any[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [poolsError, setPoolsError] = useState<string | null>(null);
  const [poolsMeta, setPoolsMeta] = useState<any>(null);

  const loadPositions = async () => {
    if (!account?.address) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/protocols/earnium/userPositions?address=${account.address}`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json();
      setPositions(data.data || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load positions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account?.address) {
      loadPositions();
    }
  }, [account?.address]);

  const loadRewards = async () => {
    if (!account?.address) return;
    setRewardsLoading(true);
    setRewardsError(null);
    try {
      const res = await fetch(`/api/protocols/earnium/rewards?address=${account.address}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      setRewards(json.data || []);
    } catch (e: any) {
      setRewardsError(e?.message || 'Failed to load rewards');
      setRewards([]);
    } finally {
      setRewardsLoading(false);
    }
  };

  const loadPoolBalance = async (poolIdx: number, poolAddress: string) => {
    try {
      setBalancesLoading(prev => ({ ...prev, [poolIdx]: true }));
      const res = await fetch('/api/aptos/balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: poolAddress })
      });
      const json = await res.json();
      const balances = json?.data?.balances || [];
      setPoolBalances(prev => ({ ...prev, [poolIdx]: balances }));
    } catch (e) {
      setPoolBalances(prev => ({ ...prev, [poolIdx]: [] }));
    } finally {
      setBalancesLoading(prev => ({ ...prev, [poolIdx]: false }));
    }
  };

  const loadPools = async () => {
    setPoolsLoading(true);
    setPoolsError(null);
    try {
      const response = await fetch('/api/protocols/earnium/pools');
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json();
      setPools(data.data || []);
      setPoolsMeta(data.meta || null);
    } catch (e: any) {
      setPoolsError(e?.message || 'Failed to load pools');
      setPools([]);
    } finally {
      setPoolsLoading(false);
    }
  };

  const hasClaimableRewards = Array.isArray(rewards) && rewards.some((pool: any) =>
    Array.isArray(pool.rewards) && pool.rewards.some((r: any) => Number(r.amountRaw || 0) > 0)
  );

  const claimAllRewards = async () => {
    if (!account?.address) return;
    try {
      setClaiming(true);
      const functionAddress = '0x7c92a9636a412407aaede35eb2654d176477c00a47bc11ea3338d1f571ec95bc';
      const payload = {
        function: `${functionAddress}::premium_staked_pool::claim_all_rewards` as `${string}::${string}::${string}`,
        typeArguments: [] as string[],
        functionArguments: [[0, 1, 2, 3]] as any[]
      } as const;

      if (!signAndSubmitTransaction) {
        throw new Error('Wallet signAndSubmitTransaction is not available');
      }
      const tx = await signAndSubmitTransaction({ data: payload } as any);

      console.log('[Earnium] Claim all submitted:', tx);
      alert('Claim transaction submitted! Check wallet/Explorer for status.');
      // Refresh rewards after short delay
      setTimeout(() => {
        loadRewards();
      }, 1500);
    } catch (e: any) {
      console.error('[Earnium] Claim all error:', e);
      alert(`Claim failed: ${e?.message || e}`);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Earnium Test Page</h1>
        <p className="text-muted-foreground">Positions and rewards view for Earnium</p>
      </div>

      {/* Positions block removed as requested */}

      <Card>
        <CardHeader>
          <CardTitle>Pools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button onClick={loadPools} disabled={poolsLoading}>
                {poolsLoading ? 'Loading...' : 'Load Pools'}
              </Button>
            </div>
            {poolsMeta && (
              <div className="text-sm text-muted-foreground">
                <div>Loaded: {poolsMeta.totalPools} pools from {poolsMeta.pagesFetched} pages</div>
                {poolsMeta.totalLoaded && poolsMeta.totalLoaded > poolsMeta.totalPools && (
                  <div className="text-orange-600">
                    Filtered: {poolsMeta.totalLoaded - poolsMeta.totalPools} pools removed ({poolsMeta.volumeFilter})
                  </div>
                )}
                {poolsMeta.totalAvailable && poolsMeta.totalAvailable > poolsMeta.totalLoaded && (
                  <div className="text-blue-600">
                    Total available: {poolsMeta.totalAvailable} pools
                  </div>
                )}
              </div>
            )}
          </div>
          {poolsError && <div className="text-sm text-red-600 mb-3">{poolsError}</div>}
          {Array.isArray(pools) && pools.length > 0 ? (
            <div className="space-y-4">
              {pools.map((pool: any) => (
                <div key={pool.poolId} className="border rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-lg">{pool.name}</div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">{pool.totalAPY}%</div>
                      <div className="text-sm text-muted-foreground">APY</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground">Asset:</span>{' '}
                      <span className="font-medium">{pool.asset}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Protocol:</span>{' '}
                      <span className="font-medium">{pool.protocol}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pool Type:</span>{' '}
                      <span className="font-medium">{pool.poolType}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">TVL:</span>{' '}
                      <span className="font-medium">${pool.tvlUSD?.toLocaleString() || '0'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Daily Volume:</span>{' '}
                      <span className="font-medium">${pool.dailyVolumeUSD?.toLocaleString() || '0'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fee Tier:</span>{' '}
                      <span className="font-medium">{pool.feeTier ? (pool.feeTier / 10000).toFixed(2) + '%' : 'N/A'}</span>
                    </div>
                  </div>
                  {pool.description && (
                    <div className="text-sm text-muted-foreground mb-2">{pool.description}</div>
                  )}
                  {pool.token0 && pool.token1 && (
                    <div className="text-xs text-muted-foreground mb-2">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          {pool.token0.icon_uri && (
                            <img src={pool.token0.icon_uri} alt={pool.token0.symbol} width={16} height={16} className="rounded" />
                          )}
                          <span>{pool.token0.symbol}</span>
                          <span className="text-gray-400">({pool.token0.price ? `$${pool.token0.price.toFixed(4)}` : 'No price'})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {pool.token1.icon_uri && (
                            <img src={pool.token1.icon_uri} alt={pool.token1.symbol} width={16} height={16} className="rounded" />
                          )}
                          <span>{pool.token1.symbol}</span>
                          <span className="text-gray-400">({pool.token1.price ? `$${pool.token1.price.toFixed(4)}` : 'No price'})</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {pool.aprBreakdown && (
                    <div className="mt-3 p-3 bg-gray-50 rounded text-xs">
                      <div className="font-semibold mb-2">APR Breakdown:</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Trading Fees:</span>{' '}
                          <span className="font-medium">{pool.aprBreakdown.breakdown.tradingFees.toFixed(2)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Rewards:</span>{' '}
                          <span className="font-medium">{pool.aprBreakdown.breakdown.rewards.toFixed(2)}%</span>
                        </div>
                        {pool.aprBreakdown.breakdown.subPoolRewards > 0 && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">SubPool Rewards:</span>{' '}
                            <span className="font-medium">{pool.aprBreakdown.breakdown.subPoolRewards.toFixed(2)}%</span>
                          </div>
                        )}
                        <div className="col-span-2 pt-1 border-t">
                          <span className="text-muted-foreground">Total APR:</span>{' '}
                          <span className="font-bold text-green-600">{pool.aprBreakdown.totalApr.toFixed(2)}%</span>
                        </div>
                      </div>
                      {pool.aprBreakdown.rewardTokens && pool.aprBreakdown.rewardTokens.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="font-semibold mb-1">Reward Tokens:</div>
                          <div className="space-y-1">
                            {pool.aprBreakdown.rewardTokens.map((reward: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-gray-600">
                                    {reward.tokenAddress.slice(0, 6)}...{reward.tokenAddress.slice(-4)}
                                  </span>
                                  <span className="text-gray-500">({reward.source})</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-medium">{reward.apr.toFixed(2)}%</span>
                                  {reward.amount > 0 && (
                                    <span className="text-gray-500 ml-1">({reward.amount.toFixed(2)} tokens)</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    Pool Address: <span className="font-mono">{pool.token}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No pools data</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rewards (Pools 0-3)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <Button onClick={loadRewards} disabled={rewardsLoading || !account?.address}>
              {rewardsLoading ? 'Loading...' : 'Refresh'}
            </Button>
            {hasClaimableRewards && account?.address && (
              <Button onClick={claimAllRewards} disabled={claiming} variant="secondary">
                {claiming ? 'Claiming...' : 'Claim All Rewards'}
              </Button>
            )}
            {!account?.address && (
              <span className="text-sm text-muted-foreground">Connect wallet to view rewards</span>
            )}
          </div>
          {rewardsError && <div className="text-sm text-red-600 mb-3">{rewardsError}</div>}
          {Array.isArray(rewards) && rewards.length > 0 ? (
            <div className="space-y-4">
              {rewards.map((poolItem: any) => (
                <div key={poolItem.pool} className="border rounded p-3">
                  <div className="font-semibold mb-2">Pool #{poolItem.pool}</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm mb-2">
                    <div>
                      <span className="text-muted-foreground">Staked:</span>{' '}
                      <span className="font-medium">{poolItem.staked?.toLocaleString?.() ?? poolItem.staked}</span>
                      <span className="text-gray-400"> ({poolItem.stakedRaw} raw)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Wallet balance:</span>{' '}
                      <span className="font-medium">{poolItem.walletBalance?.toLocaleString?.() ?? poolItem.walletBalance}</span>
                      <span className="text-gray-400"> ({poolItem.walletBalanceRaw} raw)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Unlock time:</span>{' '}
                      <span className="font-mono">{poolItem.unlockTime}</span>
                    </div>
                  </div>
                  {poolItem.poolAddress && (
                    <div className="text-xs text-muted-foreground mb-2">
                      Pool address: <span className="font-mono">{poolItem.poolAddress}</span>
                      {poolItem.lp && (
                        <span className="ml-2">
                          • LP supply: <span className="font-medium">{(poolItem.lp.totalSupply ?? 0).toLocaleString()}</span>
                          <span className="text-gray-400"> ({poolItem.lp.totalSupplyRaw} raw)</span>
                          {typeof poolItem.lp.sharePercent === 'number' && (
                            <span className="ml-2">• Your share: <span className="font-medium">{poolItem.lp.sharePercent.toFixed(2)}%</span></span>
                          )}
                        </span>
                      )}
                      <span className="ml-2">
                        <button
                          className="underline"
                          onClick={() => loadPoolBalance(poolItem.pool, poolItem.lp?.metadataId || poolItem.poolAddress)}
                          disabled={balancesLoading[poolItem.pool]}
                        >
                          {balancesLoading[poolItem.pool] ? 'Loading balances…' : 'Load pool balances'}
                        </button>
                      </span>
                    </div>
                  )}
                  {Array.isArray(poolBalances[poolItem.pool]) && poolBalances[poolItem.pool].length > 0 && (
                    <div className="mt-2 text-xs">
                      <div className="font-semibold mb-1">Pool token balances:</div>
                      <div className="space-y-1">
                        {poolBalances[poolItem.pool].map((b: any, i: number) => {
                          const findToken = (address: string) => {
                            const addr = address?.toLowerCase();
                            const tokens = (tokenList as any).data?.data || [];
                            return tokens.find((t: any) => {
                              const fa = t.faAddress ? t.faAddress.toLowerCase() : null;
                              const coin = t.tokenAddress ? t.tokenAddress.toLowerCase() : null;
                              return fa === addr || coin === addr;
                            });
                          };
                          const t = findToken(b.asset_type);
                          const symbol = t?.symbol || t?.panoraSymbol || b.asset_type.slice(0, 6) + '…';
                          const decimals = typeof t?.decimals === 'number' ? t.decimals : 8;
                          const toHuman = (raw: bigint, d: number) => Number(raw) / Math.pow(10, d);
                          const poolAmountRaw = (() => { try { return BigInt(b.amount || '0'); } catch { return BigInt(0); } })();
                          const totalSupplyRaw = (() => { try { return BigInt(poolItem.lp?.totalSupplyRaw || '0'); } catch { return BigInt(0); } })();
                          const stakedRaw = (() => { try { return BigInt(poolItem.stakedRaw || '0'); } catch { return BigInt(0); } })();
                          const userAmountRaw = totalSupplyRaw > BigInt(0) ? (poolAmountRaw * stakedRaw) / totalSupplyRaw : BigInt(0);
                          const poolAmount = toHuman(poolAmountRaw, decimals);
                          const userAmount = toHuman(userAmountRaw, decimals);
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="w-28 font-medium">{symbol}</span>
                              <span className="text-gray-600">Pool: {poolAmount.toLocaleString()} <span className="text-gray-400">({b.amount} raw)</span></span>
                              <span className="text-gray-700">• You: {userAmount.toLocaleString()} <span className="text-gray-400">({userAmountRaw.toString()} raw)</span></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {poolItem.rewards.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No rewards</div>
                  ) : (
                    <div className="space-y-2">
                      {poolItem.rewards.map((r: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          {r.logoUrl && (
                            <img src={r.logoUrl} alt={r.symbol} width={16} height={16} className="rounded" />
                          )}
                          <span className="font-medium">{r.symbol}</span>
                          <span className="text-gray-500">{r.amount.toLocaleString()}</span>
                          <span className="text-gray-400">({r.amountRaw} raw)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No rewards data</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


