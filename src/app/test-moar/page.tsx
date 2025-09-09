"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

export default function TestMoarPage() {
  const { account } = useWallet();
  const [testAddress, setTestAddress] = useState('');
  const [poolsData, setPoolsData] = useState<any>(null);
  const [positionsData, setPositionsData] = useState<any>(null);
  const [isLoadingPools, setIsLoadingPools] = useState(false);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = testAddress || account?.address?.toString() || '';

  const fetchPools = async () => {
    setIsLoadingPools(true);
    setError(null);
    try {
      console.log('🔍 Fetching Moar Market pools...');
      const response = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::pool::get_all_pools',
          type_arguments: [],
          arguments: []
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pools: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Raw pools data:', data);
      console.log('📊 Pools count:', Array.isArray(data) ? data.length : 'Not an array');
      console.log('📊 Pools type:', typeof data);
      
      // Extract the actual pools array from the response
      const actualPools = Array.isArray(data) && data.length > 0 ? data[0] : data;
      console.log('📊 Extracted pools:', actualPools);
      console.log('📊 Extracted pools count:', Array.isArray(actualPools) ? actualPools.length : 'Not an array');
      
      setPoolsData(actualPools);
    } catch (err) {
      console.error('❌ Error fetching pools:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingPools(false);
    }
  };

  const fetchUserPositions = async () => {
    if (!address) {
      setError('Please enter an address');
      return;
    }

    setIsLoadingPositions(true);
    setError(null);
    try {
      console.log('🔍 Fetching user positions for address:', address);
      
      // First get pools if we don't have them
      let pools = poolsData;
      if (!pools) {
        const poolsResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            function: '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::pool::get_all_pools',
            type_arguments: [],
            arguments: []
          })
        });
        const poolsData = await poolsResponse.json();
        // Extract the actual pools array from the response
        pools = Array.isArray(poolsData) && poolsData.length > 0 ? poolsData[0] : poolsData;
      }

      const positions: any[] = [];

      console.log('📊 Total pools to check:', pools.length);
      console.log('📊 Pools array:', pools);
      
      // Check each pool for user positions
      for (let poolId = 0; poolId < pools.length; poolId++) {
        try {
          console.log(`📈 Checking pool ${poolId} for user ${address}`);
          
          const positionResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              function: '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::lens::get_lp_shares_and_deposited_amount',
              type_arguments: [],
              arguments: [poolId.toString(), address]
            })
          });

          if (!positionResponse.ok) {
            console.warn(`Failed to fetch position for pool ${poolId}:`, positionResponse.status);
            continue;
          }

          const positionData = await positionResponse.json();
          console.log(`📈 Pool ${poolId} raw position data:`, positionData);

          positions.push({
            poolId,
            poolInfo: pools[poolId],
            rawPositionData: positionData,
            depositedAmount: positionData[1], // Second number is deposited amount
            hasPosition: positionData[1] && positionData[1] !== '0'
          });
        } catch (error) {
          console.warn(`Error checking pool ${poolId}:`, error);
          positions.push({
            poolId,
            poolInfo: pools[poolId],
            rawPositionData: null,
            depositedAmount: '0',
            hasPosition: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log('✅ All positions data:', positions);
      setPositionsData(positions);
    } catch (err) {
      console.error('❌ Error fetching positions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingPositions(false);
    }
  };

  const testOurAPI = async () => {
    if (!address) {
      setError('Please enter an address');
      return;
    }

    setIsLoadingPositions(true);
    setError(null);
    try {
      console.log('🔍 Testing our Moar Market API...');
      const response = await fetch(`/api/protocols/moar/userPositions?address=${address}`);
      const data = await response.json();
      console.log('📊 Our API response:', data);
      setPositionsData({ ourAPI: data });
    } catch (err) {
      console.error('❌ Error testing our API:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingPositions(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Moar Market Test Page</h1>
        <p className="text-muted-foreground">Test Moar Market API integration and user positions</p>
      </div>

      {/* Address Input */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address">Wallet Address</Label>
            <Input
              id="address"
              value={testAddress}
              onChange={(e) => setTestAddress(e.target.value)}
              placeholder={account?.address?.toString() || "Enter wallet address"}
              className="mt-1"
            />
            {account?.address && (
              <p className="text-sm text-muted-foreground mt-1">
                Connected wallet: {account.address.toString()}
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button onClick={fetchPools} disabled={isLoadingPools}>
              {isLoadingPools ? 'Loading...' : 'Fetch Pools'}
            </Button>
            <Button onClick={fetchUserPositions} disabled={isLoadingPositions || !address}>
              {isLoadingPositions ? 'Loading...' : 'Fetch User Positions'}
            </Button>
            <Button onClick={testOurAPI} disabled={isLoadingPositions || !address} variant="outline">
              {isLoadingPositions ? 'Loading...' : 'Test Our API'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Pools Data */}
      {poolsData && (
        <Card>
          <CardHeader>
            <CardTitle>Raw Pools Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Found {Array.isArray(poolsData) ? poolsData.length : 'unknown'} pools
              </p>
              <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                <pre className="text-xs">
                  {JSON.stringify(poolsData, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Positions Data */}
      {positionsData && (
        <Card>
          <CardHeader>
            <CardTitle>User Positions Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {positionsData.ourAPI ? (
                <div>
                  <h3 className="font-semibold mb-2">Our API Response:</h3>
                  <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                    <pre className="text-xs">
                      {JSON.stringify(positionsData.ourAPI, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Checking {Array.isArray(positionsData) ? positionsData.length : 'unknown'} pools for user positions
                  </p>
                  
                  {Array.isArray(positionsData) && positionsData.map((position, index) => (
                    <div key={index} className="border rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">
                          Pool #{position.poolId} - {position.poolInfo?.name || 'Unknown'}
                        </h3>
                        <div className="text-sm">
                          {position.hasPosition ? (
                            <span className="text-green-600 font-medium">
                              Has Position: {position.depositedAmount}
                            </span>
                          ) : (
                            <span className="text-gray-500">No Position</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-sm mb-2">Pool Info:</h4>
                          <div className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-32">
                            <pre>{JSON.stringify(position.poolInfo, null, 2)}</pre>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm mb-2">Raw Position Data:</h4>
                          <div className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-32">
                            <pre>
                              {position.rawPositionData ? 
                                JSON.stringify(position.rawPositionData, null, 2) : 
                                'No data'
                              }
                            </pre>
                          </div>
                        </div>
                      </div>
                      
                      {position.error && (
                        <div className="mt-2 text-red-600 text-sm">
                          Error: {position.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>1. <strong>Fetch Pools</strong> - Gets all available lending pools from Moar Market</p>
            <p>2. <strong>Fetch User Positions</strong> - Checks each pool for user positions using the lens function</p>
            <p>3. <strong>Test Our API</strong> - Tests our internal API endpoint</p>
            <p>4. Compare raw data with our processed data to debug any issues</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
