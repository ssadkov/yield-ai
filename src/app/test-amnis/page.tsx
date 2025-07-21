'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Badge } from '@/components/ui/badge';

export default function TestAmnisPage() {
  const { account } = useWallet();
  const [pools, setPools] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [testAmount, setTestAmount] = useState('1000000'); // 1 APT in octas
  const [testToken, setTestToken] = useState('0x1::aptos_coin::AptosCoin');
  const [apiData, setApiData] = useState<any>(null);

  const fetchPools = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/protocols/amnis/pools');
      const data = await response.json();
      console.log('Amnis pools:', data);
      setPools(data.pools || []);
      setApiData(data.apiData || null);
    } catch (error) {
      console.error('Error fetching Amnis pools:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    if (!account?.address) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/protocols/amnis/userPositions?address=${account.address}`);
      const data = await response.json();
      console.log('Amnis positions:', data);
      setPositions(data.positions || []);
    } catch (error) {
      console.error('Error fetching Amnis positions:', error);
    } finally {
      setLoading(false);
    }
  };

  const testDeposit = async () => {
    try {
      const response = await fetch('/api/protocols/amnis/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: testToken,
          amount: testAmount,
        }),
      });
      const data = await response.json();
      console.log('Deposit payload:', data);
      alert('Deposit payload generated successfully! Check console for details.');
    } catch (error) {
      console.error('Error generating deposit payload:', error);
      alert('Error generating deposit payload');
    }
  };

  const testWithdraw = async () => {
    try {
      const response = await fetch('/api/protocols/amnis/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: testToken,
          amount: testAmount,
        }),
      });
      const data = await response.json();
      console.log('Withdraw payload:', data);
      alert('Withdraw payload generated successfully! Check console for details.');
    } catch (error) {
      console.error('Error generating withdraw payload:', error);
      alert('Error generating withdraw payload');
    }
  };

  const testClaim = async () => {
    try {
      const response = await fetch('/api/protocols/amnis/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          positionIds: ['test-position-1'],
          tokenTypes: ['0x1::aptos_coin::AptosCoin'],
        }),
      });
      const data = await response.json();
      console.log('Claim payload:', data);
      alert('Claim payload generated successfully! Check console for details.');
    } catch (error) {
      console.error('Error generating claim payload:', error);
      alert('Error generating claim payload');
    }
  };

  const testPoolsIntegration = async () => {
    try {
      const response = await fetch('/api/aptos/pools');
      const data = await response.json();
      console.log('All pools (including Amnis):', data);
      
      // Filter Amnis pools
      const amnisPools = data.data?.filter((pool: any) => pool.protocol === 'Amnis Finance') || [];
      console.log('Amnis pools in main pools API:', amnisPools);
      
      alert(`Found ${amnisPools.length} Amnis pools in main pools API! Check console for details.`);
    } catch (error) {
      console.error('Error testing pools integration:', error);
      alert('Error testing pools integration');
    }
  };

  useEffect(() => {
    fetchPools();
    if (account?.address) {
      fetchPositions();
    }
  }, [account?.address]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <img 
          src="/amnis-logo.png" 
          alt="Amnis Finance" 
          className="w-12 h-12 rounded"
        />
        <div>
          <h1 className="text-3xl font-bold">Amnis Finance Integration Test</h1>
          <p className="text-muted-foreground">Test the Amnis Finance protocol integration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pools */}
        <Card>
          <CardHeader>
            <CardTitle>Pools (Real API Data)</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchPools} disabled={loading} className="mb-4">
              {loading ? 'Loading...' : 'Refresh Pools'}
            </Button>
            <div className="space-y-2">
              {pools.map((pool, index) => (
                <div key={index} className="p-3 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{pool.name}</h3>
                    <Badge variant={pool.isActive ? "default" : "secondary"}>
                      {pool.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{pool.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Asset:</span> {pool.asset}
                    </div>
                    <div>
                      <span className="font-medium">APR:</span> {pool.apr?.toFixed(2)}%
                    </div>
                    <div>
                      <span className="font-medium">Total Staked:</span> {pool.totalStaked?.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Token:</span> {pool.token.substring(0, 20)}...
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* API Data */}
        <Card>
          <CardHeader>
            <CardTitle>Raw API Data</CardTitle>
          </CardHeader>
          <CardContent>
            {apiData ? (
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">APR:</span> {apiData.apr?.toFixed(4)}%</div>
                <div><span className="font-medium">APT Price:</span> ${apiData.aptPrice}</div>
                <div><span className="font-medium">amAPT Price:</span> ${apiData.amAptPrice}</div>
                <div><span className="font-medium">stAPT Total Supply:</span> {apiData.stAptTotalSupply?.toLocaleString()}</div>
                <div><span className="font-medium">amAPT Total Supply:</span> {apiData.amAptTotalSupply?.toLocaleString()}</div>
                <div><span className="font-medium">Stakers:</span> {apiData.staker?.toLocaleString()}</div>
                <div><span className="font-medium">Liquid Rate:</span> {apiData.liquidRate}</div>
                <div><span className="font-medium">Pancake Rate:</span> {apiData.pancakeRate}</div>
                <div><span className="font-medium">Panora Rate:</span> {apiData.panoraRate}</div>
                <div><span className="font-medium">Cellana Rate:</span> {apiData.cellanaRate}</div>
              </div>
            ) : (
              <p className="text-muted-foreground">No API data loaded</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Positions */}
      <Card>
        <CardHeader>
          <CardTitle>User Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchPositions} disabled={loading || !account?.address} className="mb-4">
            {loading ? 'Loading...' : 'Refresh Positions'}
          </Button>
          {!account?.address && (
            <p className="text-muted-foreground">Connect wallet to view positions</p>
          )}
          <div className="space-y-2">
            {positions.map((position, index) => (
              <div key={index} className="p-3 border rounded">
                <h3 className="font-semibold">{position.poolName}</h3>
                <p className="text-sm">Staked: {position.stakedAmount}</p>
                <p className="text-sm">Value: ${position.value}</p>
                <p className="text-sm">APY: {position.apy}%</p>
                <p className="text-sm">Rewards: {position.rewards}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transaction Testing */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="token">Token Address</Label>
              <Input
                id="token"
                value={testToken}
                onChange={(e) => setTestToken(e.target.value)}
                placeholder="0x1::aptos_coin::AptosCoin"
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount (octas)</Label>
              <Input
                id="amount"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                placeholder="1000000"
              />
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button onClick={testDeposit} variant="default">
              Test Deposit
            </Button>
            <Button onClick={testWithdraw} variant="outline">
              Test Withdraw
            </Button>
            <Button onClick={testClaim} variant="secondary">
              Test Claim
            </Button>
            <Button onClick={testPoolsIntegration} variant="destructive">
              Test Pools Integration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Protocol Info */}
      <Card>
        <CardHeader>
          <CardTitle>Protocol Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold">Amnis Finance</h3>
              <p className="text-sm text-muted-foreground">Pioneering Liquid Staking protocol on Aptos</p>
              <p className="text-sm">Category: Staking</p>
              <p className="text-sm">URL: <a href="https://stake.amnis.finance/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">stake.amnis.finance</a></p>
            </div>
            <div>
              <h3 className="font-semibold">Integration Status</h3>
              <p className="text-sm text-green-600">✅ Protocol class created</p>
              <p className="text-sm text-green-600">✅ API endpoints implemented</p>
              <p className="text-sm text-green-600">✅ UI components created</p>
              <p className="text-sm text-green-600">✅ Portfolio integration complete</p>
              <p className="text-sm text-green-600">✅ Management interface ready</p>
              <p className="text-sm text-green-600">✅ Pools integration added</p>
              <p className="text-sm text-green-600">✅ Real API data integration</p>
              <p className="text-sm text-green-600">✅ Logo added</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 