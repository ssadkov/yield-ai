'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

export default function TestEarniumPage() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

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

      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <Button onClick={loadPositions} disabled={loading || !account?.address}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            {!account?.address && (
              <span className="text-sm text-muted-foreground">Connect wallet to view positions</span>
            )}
          </div>
          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
          {positions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No positions found</div>
          ) : (
            <div className="space-y-2">
              {positions.map((pos, idx) => (
                <pre key={idx} className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                  {JSON.stringify(pos, null, 2)}
                </pre>
              ))}
            </div>
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


