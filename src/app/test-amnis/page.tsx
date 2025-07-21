'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Badge } from '@/components/ui/badge';

export default function TestAmnisPage() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [pools, setPools] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [testAmount, setTestAmount] = useState('100000000'); // 1 APT in octas (8 decimals)
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
      console.log('Testing APT deposit with correct format...');
      
      // Convert Uint8Array address to hex string if needed
      let walletAddress: string;
      if (account?.address?.data && Array.isArray(account.address.data)) {
        walletAddress = '0x' + Array.from(account.address.data)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        walletAddress = account?.address?.toString() || "0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97";
      }
      
      const response = await fetch('/api/protocols/amnis/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: testToken,
          amount: testAmount,
          walletAddress: walletAddress
        }),
      });
      const data = await response.json();
      console.log('Generated payload:', data);
      
      // Show expected format for APT
      if (testToken === "0x1::aptos_coin::AptosCoin") {
        const expectedPayload = {
          type: "entry_function_payload",
          function: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::router::deposit_and_stake_entry",
          type_arguments: [],
          arguments: [
            testAmount,
            walletAddress
          ]
        };
        console.log('Expected APT payload format:', expectedPayload);
        console.log('Generated payload format:', data);
        
        // Verify the format is correct
        if (data.arguments && Array.isArray(data.arguments) && data.arguments.length === 2) {
          console.log('✅ Arguments format is correct:');
          console.log('  Amount:', data.arguments[0], 'Type:', typeof data.arguments[0]);
          console.log('  Address:', data.arguments[1], 'Type:', typeof data.arguments[1]);
          
          // Check if arguments are strings (not serialized bytes)
          if (typeof data.arguments[0] === 'string' && typeof data.arguments[1] === 'string') {
            console.log('✅ Arguments are strings (not serialized bytes)');
            alert(`✅ APT Deposit payload generated successfully!\n\nFunction: ${data.function}\nArguments: [${data.arguments.join(', ')}]\n\nArguments are in correct string format.`);
          } else {
            console.log('❌ Arguments are not strings:', data.arguments);
            alert(`❌ Arguments format issue!\n\nArguments: ${JSON.stringify(data.arguments)}\n\nExpected strings, got: ${typeof data.arguments[0]}, ${typeof data.arguments[1]}`);
          }
        } else {
          console.log('❌ Arguments format is incorrect:', data.arguments);
          alert(`❌ Arguments format issue!\n\nExpected array with 2 elements, got: ${JSON.stringify(data.arguments)}`);
        }
      } else {
        alert('Deposit payload generated successfully! Check console for details.');
      }
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

  const testArgumentFormat = () => {
    console.log('=== Testing Argument Format ===');
    
    // Test different formats
    const testCases = [
      {
        name: 'String amount',
        amount: "1000000",
        address: "0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97"
      },
      {
        name: 'Number amount',
        amount: 1000000,
        address: "0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97"
      },
      {
        name: 'BigInt amount',
        amount: BigInt(1000000),
        address: "0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97"
      }
    ];
    
    testCases.forEach(testCase => {
      console.log(`\n${testCase.name}:`);
      console.log('Amount:', testCase.amount, 'Type:', typeof testCase.amount);
      console.log('Address:', testCase.address, 'Type:', typeof testCase.address);
      
      const payload = {
        type: "entry_function_payload",
        function: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::router::deposit_and_stake_entry",
        type_arguments: [],
        arguments: [
          testCase.amount.toString(),
          testCase.address
        ]
      };
      
      console.log('Generated payload:', payload);
    });
    
    alert('Argument format test completed. Check console for details.');
  };

  const testRealDeposit = async () => {
    if (!account?.address) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      console.log('Testing real APT deposit transaction...');
      console.log('Account address:', account.address);
      console.log('Test amount:', testAmount);
      console.log('Test token:', testToken);
      
      // Convert Uint8Array address to hex string
      let walletAddress: string;
      if (account.address.data && Array.isArray(account.address.data)) {
        // Convert Uint8Array to hex string
        walletAddress = '0x' + Array.from(account.address.data)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        console.log('Converted wallet address:', walletAddress);
      } else {
        walletAddress = account.address.toString();
        console.log('Using address as string:', walletAddress);
      }
      
      // First, get the payload
      const response = await fetch('/api/protocols/amnis/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: testToken,
          amount: testAmount,
          walletAddress: walletAddress
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const payload = await response.json();
      console.log('Generated payload for real transaction:', payload);
      console.log('Payload arguments:', payload.arguments);
      console.log('Payload arguments types:', payload.arguments.map((arg: any) => ({ value: arg, type: typeof arg })));
      console.log('Payload arguments JSON:', JSON.stringify(payload.arguments));
      
      // Verify payload format
      if (!payload.arguments || !Array.isArray(payload.arguments) || payload.arguments.length !== 2) {
        throw new Error('Invalid payload format');
      }
      
      if (typeof payload.arguments[0] !== 'string' || typeof payload.arguments[1] !== 'string') {
        console.error('Arguments are not strings:', {
          arg0: { value: payload.arguments[0], type: typeof payload.arguments[0] },
          arg1: { value: payload.arguments[1], type: typeof payload.arguments[1] }
        });
        throw new Error('Arguments must be strings');
      }
      
      console.log('✅ Payload format is correct, proceeding with transaction...');
      
      // Submit transaction using wallet
      if (!signAndSubmitTransaction) {
        throw new Error('Wallet does not support transaction signing');
      }
      
      const txResponse = await signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.type_arguments,
          functionArguments: payload.arguments
        },
        options: {
          maxGasAmount: 20000,
        },
      });
      
      console.log('Transaction submitted successfully:', txResponse);
      alert(`✅ Transaction submitted successfully!\n\nHash: ${txResponse.hash}\n\nCheck your wallet for confirmation.`);
      
    } catch (error) {
      console.error('Real deposit test failed:', error);
      alert(`❌ Real deposit test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Test Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (octas)</label>
                  <input
                    type="text"
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="100000000"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {testAmount ? `${Number(testAmount) / 100000000} APT` : 'Enter amount'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Token</label>
                  <select
                    value={testToken}
                    onChange={(e) => setTestToken(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="0x1::aptos_coin::AptosCoin">APT</option>
                    <option value="0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt">amAPT</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={testDeposit} variant="default">
                Test Deposit
              </Button>
              <Button onClick={testArgumentFormat} variant="outline">
                Test Argument Format
              </Button>
              <Button onClick={testRealDeposit} variant="default">
                Test Real Deposit
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