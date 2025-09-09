"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { PanoraPricesService } from '@/lib/services/panora/prices';
import { useClaimRewards } from '@/lib/hooks/useClaimRewards';

export default function TestMoarPage() {
  const { account } = useWallet();
  const { claimRewards, isLoading: isClaiming } = useClaimRewards();
  const [testAddress, setTestAddress] = useState('');
  const [poolsData, setPoolsData] = useState<any>(null);
  const [positionsData, setPositionsData] = useState<any>(null);
  const [rewardsData, setRewardsData] = useState<any>(null);
  const [isLoadingPools, setIsLoadingPools] = useState(false);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pricesService = PanoraPricesService.getInstance();

  const address = testAddress || account?.address?.toString() || '';

  // Claim rewards function
  const handleClaimReward = async (reward: any) => {
    if (!reward.reward_id || !reward.farming_identifier) {
      console.error('Missing reward_id or farming_identifier');
      return;
    }

    try {
      await claimRewards('moar', [reward.farming_identifier], [reward.reward_id]);
      // Refresh rewards data after successful claim
      setTimeout(() => {
        fetchRewards();
      }, 2000);
    } catch (error) {
      console.error('Error claiming reward:', error);
    }
  };

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

  const fetchRewards = async () => {
    if (!address) {
      setError('Please enter an address or connect wallet');
      return;
    }

    setIsLoadingRewards(true);
    setError(null);
    try {
      console.log('🔍 Fetching rewards for address:', address);
      
      // Get Staker resource
      const resourceResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/accounts/${address}/resource/0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::farming::Staker`);
      
      if (!resourceResponse.ok) {
        if (resourceResponse.status === 404) {
          console.log('📊 No Staker resource found for this address');
          setRewardsData({ message: 'No Staker resource found' });
          return;
        }
        throw new Error(`Failed to fetch Staker resource: ${resourceResponse.status}`);
      }
      
      const stakerResource = await resourceResponse.json();
      console.log('📊 Staker resource:', stakerResource);
      
      const userPools = stakerResource.data.user_pools;
      if (!userPools || !userPools.entries || userPools.entries.length === 0) {
        console.log('📊 No user pools found');
        setRewardsData({ message: 'No user pools found' });
        return;
      }
      
      console.log('📊 User pools entries:', userPools.entries);
      
      const rewards: any[] = [];
      
      // Process each user pool
      for (const poolEntry of userPools.entries) {
        const farmingIdentifier = poolEntry.value.farming_identifier;
        const poolRewards = poolEntry.value.rewards;
        
        console.log(`📊 Processing pool ${farmingIdentifier} with rewards:`, poolRewards);
        
        if (poolRewards && poolRewards.entries) {
          // Process each reward in the pool
          for (const rewardEntry of poolRewards.entries) {
            const rewardId = rewardEntry.key;
            const rewardData = rewardEntry.value;
            
            console.log(`📊 Processing reward ${rewardId}:`, rewardData);
            
            try {
              // Call claimable_reward_amount view function
              const claimableResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  function: '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::farming::claimable_reward_amount',
                  type_arguments: [],
                  arguments: [address, rewardId, farmingIdentifier]
                })
              });
              
              if (claimableResponse.ok) {
                const claimableAmount = await claimableResponse.json();
                console.log(`📊 Claimable amount for ${rewardId}:`, claimableAmount);
                
                rewards.push({
                  farming_identifier: farmingIdentifier,
                  reward_id: rewardId,
                  reward_amount: rewardData.reward_amount,
                  claimable_amount: claimableAmount,
                  last_acc_rewards_per_share: rewardData.last_acc_rewards_per_share
                });
              } else {
                console.warn(`Failed to get claimable amount for ${rewardId}:`, claimableResponse.status);
              }
            } catch (err) {
              console.warn(`Error getting claimable amount for ${rewardId}:`, err);
            }
          }
        }
      }
      
      console.log('📊 Final rewards data:', rewards);
      
      // Get APT price for rewards containing APT
      const aptRewards = rewards.filter((reward: any) => reward.reward_id.includes('APT'));
      if (aptRewards.length > 0) {
        try {
          console.log('💰 Fetching APT price for rewards...');
          const aptAddress = '0x1::aptos_coin::AptosCoin';
          const pricesResponse = await pricesService.getPrices(1, [aptAddress]);
          console.log('💰 Prices response:', pricesResponse);
          const prices = pricesResponse.data || pricesResponse;
          const aptPrice = prices.find((p: any) => 
            p.tokenAddress === aptAddress || p.faAddress === aptAddress
          );
          
          if (aptPrice) {
            console.log('💰 APT price found:', aptPrice);
            
            // Add USD value to APT rewards
            rewards.forEach((reward: any) => {
              if (reward.reward_id.includes('APT')) {
                const amount = parseFloat(reward.claimable_amount) / Math.pow(10, aptPrice.decimals);
                const usdValue = amount * parseFloat(aptPrice.usdPrice);
                reward.usd_value = usdValue;
                reward.token_info = {
                  symbol: aptPrice.symbol,
                  decimals: aptPrice.decimals,
                  price: aptPrice.usdPrice,
                  amount: amount
                };
                console.log(`💰 ${reward.reward_id}: ${amount} ${aptPrice.symbol} = $${usdValue.toFixed(2)}`);
              }
            });
          } else {
            console.warn('💰 APT price not found');
          }
        } catch (err) {
          console.warn('💰 Error fetching APT price:', err);
        }
      }
      
      setRewardsData(rewards);
      
    } catch (err) {
      console.error('Error fetching rewards:', err);
      setError('Failed to fetch rewards');
    } finally {
      setIsLoadingRewards(false);
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
            <Button onClick={fetchRewards} disabled={isLoadingRewards || !address} variant="secondary">
              {isLoadingRewards ? 'Loading...' : 'Fetch Rewards'}
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

      {/* Rewards Data */}
      {rewardsData && (
        <Card>
          <CardHeader>
            <CardTitle>Rewards Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rewardsData.message ? (
                <div className="text-center py-4 text-muted-foreground">
                  {rewardsData.message}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Found {Array.isArray(rewardsData) ? rewardsData.length : 'unknown'} rewards
                  </p>
                  
                  {Array.isArray(rewardsData) && rewardsData.map((reward, index) => (
                    <div key={index} className="border rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">
                          {reward.reward_id} - {reward.farming_identifier}
                        </h3>
                        <div className="text-sm">
                          <span className="text-green-600 font-medium">
                            Claimable: {reward.claimable_amount}
                          </span>
                          {reward.usd_value && (
                            <div className="text-blue-600 font-medium">
                              Value: ${reward.usd_value.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Reward ID:</strong> {reward.reward_id}
                        </div>
                        <div>
                          <strong>Farming ID:</strong> {reward.farming_identifier}
                        </div>
                        <div>
                          <strong>Reward Amount:</strong> {reward.reward_amount}
                        </div>
                        <div>
                          <strong>Claimable Amount:</strong> {reward.claimable_amount}
                        </div>
                        <div>
                          <strong>Last Acc Rewards Per Share:</strong> {reward.last_acc_rewards_per_share}
                        </div>
                        {reward.token_info && (
                          <>
                            <div>
                              <strong>Token Symbol:</strong> {reward.token_info.symbol}
                            </div>
                            <div>
                              <strong>Token Decimals:</strong> {reward.token_info.decimals}
                            </div>
                            <div>
                              <strong>Token Price:</strong> ${reward.token_info.price}
                            </div>
                            <div>
                              <strong>Token Amount:</strong> {reward.token_info.amount.toFixed(6)} {reward.token_info.symbol}
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Claim button */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <Button
                          onClick={() => handleClaimReward(reward)}
                          disabled={isClaiming}
                          size="sm"
                          className="w-full"
                        >
                          {isClaiming ? 'Claiming...' : `Claim ${reward.token_info?.symbol || 'Reward'}`}
                        </Button>
                      </div>
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
            <p>4. <strong>Fetch Rewards</strong> - Gets user rewards from Staker resource and claimable amounts</p>
            <p>5. Compare raw data with our processed data to debug any issues</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
