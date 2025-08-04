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
  const [stakingPools, setStakingPools] = useState<any[]>([]);
  const [stakingPoolsLoading, setStakingPoolsLoading] = useState(false);
  const [stakedAmounts, setStakedAmounts] = useState<{[key: string]: number}>({});
  const [stakedAmountsLoading, setStakedAmountsLoading] = useState(false);
  const [amiPrice, setAmiPrice] = useState<number>(0);
  const [amiPriceLoading, setAmiPriceLoading] = useState(false);
  const testAmount = 100000000; // 1 APT in octas
  const testToken = "0x1::aptos_coin::AptosCoin";
  const testAmAptAmount = 100482581; // amAPT amount
  const testAmAptToken = "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt";
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

  const fetchStakingPools = async () => {
    setStakingPoolsLoading(true);
    try {
      const response = await fetch('/api/protocols/amnis/staking-pools');
      const data = await response.json();
      console.log('AMI staking pools:', data);
      if (data.success) {
        setStakingPools(data.pools || []);
      } else {
        console.error('Failed to fetch staking pools:', data.error);
      }
    } catch (error) {
      console.error('Error fetching AMI staking pools:', error);
    } finally {
      setStakingPoolsLoading(false);
    }
  };

  const fetchStakedAmounts = async () => {
    if (!account?.address) return;
    
    setStakedAmountsLoading(true);
    try {
      const amounts: {[key: string]: number} = {};
      
      // Get wallet address in correct format
      let walletAddress: string;
      if (account.address.data && Array.isArray(account.address.data)) {
        walletAddress = '0x' + Array.from(account.address.data)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        walletAddress = account.address.toString();
      }

      // Fetch staked amounts for each pool
      for (const pool of stakingPools) {
        try {
          const response = await fetch(`/api/protocols/amnis/staking-amount?userAddress=${walletAddress}&poolAddress=${pool.address}`);
          const data = await response.json();
          
          if (data.success) {
            amounts[pool.address] = data.stakedAmount;
          } else {
            console.error('Failed to get staked amount for pool:', pool.address, data.error);
            amounts[pool.address] = 0;
          }
        } catch (error) {
          console.error('Error getting staked amount for pool:', pool.address, error);
          amounts[pool.address] = 0;
        }
      }
      
      setStakedAmounts(amounts);
    } catch (error) {
      console.error('Error fetching staked amounts:', error);
    } finally {
      setStakedAmountsLoading(false);
    }
  };

  const fetchAmiPrice = async () => {
    setAmiPriceLoading(true);
    try {
      // AMI token address in Panora
      const amiTokenAddress = '0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451';
      
      const response = await fetch(`/api/panora/tokenPrices?chainId=1&tokenAddress=${amiTokenAddress}`);
      const data = await response.json();
      
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const amiToken = data.data.find((token: any) => 
          token.tokenAddress === amiTokenAddress || token.faAddress === amiTokenAddress
        );
        
        if (amiToken && amiToken.usdPrice) {
          setAmiPrice(parseFloat(amiToken.usdPrice));
        } else {
          console.error('AMI token not found in Panora response');
          setAmiPrice(0);
        }
      } else {
        console.error('Failed to get AMI price from Panora');
        setAmiPrice(0);
      }
    } catch (error) {
      console.error('Error fetching AMI price:', error);
      setAmiPrice(0);
    } finally {
      setAmiPriceLoading(false);
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

  const testAmAptDeposit = async () => {
    try {
      console.log('Testing amAPT deposit with correct format...');
      
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
          token: testAmAptToken,
          amount: testAmAptAmount,
          walletAddress: walletAddress
        }),
      });
      const data = await response.json();
      console.log('Generated payload:', data);
      
      // Show expected format for amAPT
      if (testAmAptToken === "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt") {
        const expectedPayload = {
          type: "entry_function_payload",
          function: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::router::stake_entry",
          type_arguments: [],
          arguments: [
            testAmAptAmount,
            walletAddress
          ]
        };
        console.log('Expected amAPT payload format:', expectedPayload);
        console.log('Generated payload format:', data);
        
        // Verify the format is correct
        if (data.arguments && Array.isArray(data.arguments) && data.arguments.length === 2) {
          console.log('✅ Arguments format is correct:');
          console.log('  Amount:', data.arguments[0], 'Type:', typeof data.arguments[0]);
          console.log('  Address:', data.arguments[1], 'Type:', typeof data.arguments[1]);
          
          // Check if arguments are strings (not serialized bytes)
          if (typeof data.arguments[0] === 'string' && typeof data.arguments[1] === 'string') {
            console.log('✅ Arguments are strings (not serialized bytes)');
            alert(`✅ amAPT Deposit payload generated successfully!\n\nFunction: ${data.function}\nArguments: [${data.arguments.join(', ')}]\n\nArguments are in correct string format.`);
          } else {
            console.log('❌ Arguments are not strings:', data.arguments);
            alert(`❌ Arguments format issue!\n\nArguments: ${JSON.stringify(data.arguments)}\n\nExpected strings, got: ${typeof data.arguments[0]}, ${typeof data.arguments[1]}`);
          }
        } else {
          console.log('❌ Arguments format is incorrect:', data.arguments);
          alert(`❌ Arguments format issue!\n\nExpected array with 2 elements, got: ${JSON.stringify(data.arguments)}`);
        }
      } else {
        alert('amAPT Deposit payload generated successfully! Check console for details.');
      }
    } catch (error) {
      console.error('Error generating amAPT deposit payload:', error);
      alert('Error generating amAPT deposit payload');
    }
  };

  const testRealAmAptDeposit = async () => {
    if (!account?.address) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      console.log('Testing real amAPT deposit transaction...');
      console.log('Account address:', account.address);
      console.log('Test amount:', testAmAptAmount);
      console.log('Test token:', testAmAptToken);
      
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
          token: testAmAptToken,
          amount: testAmAptAmount,
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
      console.error('Real amAPT deposit test failed:', error);
      alert(`❌ Real amAPT deposit test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    fetchPools();
    fetchStakingPools();
    if (account?.address) {
      fetchPositions();
    }
  }, [account?.address]);

  useEffect(() => {
    if (stakingPools.length > 0 && account?.address) {
      fetchStakedAmounts();
    }
  }, [stakingPools, account?.address]);

  useEffect(() => {
    fetchAmiPrice();
  }, []);

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

      {/* AMI Staking Pools */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>AMI Staking Pools</CardTitle>
            {amiPrice > 0 && (
              <div className="text-sm text-muted-foreground">
                AMI Price: <span className="font-semibold text-green-600">${amiPrice.toFixed(4)}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button onClick={fetchStakingPools} disabled={stakingPoolsLoading}>
              {stakingPoolsLoading ? 'Loading...' : 'Refresh AMI Staking Pools'}
            </Button>
            {account?.address && (
              <Button onClick={fetchStakedAmounts} disabled={stakedAmountsLoading} variant="outline">
                {stakedAmountsLoading ? 'Loading...' : 'Refresh Staked Amounts'}
              </Button>
            )}
            <Button onClick={fetchAmiPrice} disabled={amiPriceLoading} variant="outline">
              {amiPriceLoading ? 'Loading...' : 'Refresh AMI Price'}
            </Button>
          </div>
          <div className="space-y-3">
            {stakingPools.map((pool, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">AMI Staking Pool #{index + 1}</h3>
                  <Badge 
                    variant={
                      pool.status === 'Active' ? 'default' : 
                      pool.status === 'Upcoming' ? 'secondary' : 
                      pool.status === 'Ended' ? 'destructive' : 'outline'
                    }
                  >
                    {pool.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Rate:</span>
                    <div className="text-lg font-bold text-green-600">{pool.ratePercentage}%</div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Lock Duration:</span>
                    <div className="font-semibold">
                      {pool.lockDurationDays > 0 ? `${pool.lockDurationDays} days` : 'No lock'}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Start Date:</span>
                    <div className="font-semibold">{pool.startDate}</div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">End Date:</span>
                    <div className="font-semibold">{pool.endDate}</div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Your Staked:</span>
                    <div className="font-semibold text-blue-600">
                      {stakedAmountsLoading ? (
                        <span className="text-xs">Loading...</span>
                      ) : (
                        <div>
                          <div>{stakedAmounts[pool.address] || 0} AMI</div>
                          {amiPrice > 0 && (
                            <div className="text-xs text-green-600">
                              ${((stakedAmounts[pool.address] || 0) * amiPrice).toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {pool.luckyWheelRate && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <span className="font-medium text-yellow-800">Lucky Wheel Rate: {pool.luckyWheelRate}%</span>
                  </div>
                )}
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium">Pool Address:</span> {pool.address}
                </div>
              </div>
            ))}
            {stakingPools.length === 0 && !stakingPoolsLoading && (
              <p className="text-muted-foreground text-center py-8">No AMI staking pools found</p>
            )}
          </div>
        </CardContent>
      </Card>

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
                <p className="text-sm">APR: {position.apy}%</p>
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
                  <label className="block text-sm font-medium mb-1">APT Amount (octas)</label>
                  <p className="text-sm text-gray-600">{testAmount} ({testAmount / 100000000} APT)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">amAPT Amount (octas)</label>
                  <p className="text-sm text-gray-600">{testAmAptAmount} ({testAmAptAmount / 100000000} amAPT)</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={testDeposit} variant="default">
                Test APT Deposit
              </Button>
              <Button onClick={testAmAptDeposit} variant="default">
                Test amAPT Deposit
              </Button>
              <Button onClick={testArgumentFormat} variant="outline">
                Test Argument Format
              </Button>
              <Button onClick={testRealDeposit} variant="default">
                Test Real APT Deposit
              </Button>
              <Button onClick={testRealAmAptDeposit} variant="default">
                Test Real amAPT Deposit
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