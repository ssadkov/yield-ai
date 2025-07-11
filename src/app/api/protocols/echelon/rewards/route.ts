import { NextRequest, NextResponse } from 'next/server';

const ECHELON_FARMING_ADDRESS = "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba";
const APTOS_API_KEY = process.env.APTOS_API_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ 
      success: false, 
      error: 'Address parameter is required' 
    }, { status: 400 });
  }

  if (!APTOS_API_KEY) {
    return NextResponse.json({ 
      success: false, 
      error: 'APTOS_API_KEY is not configured' 
    }, { status: 500 });
  }

  try {
    // Get account resources
    const resourcesResponse = await fetch(
      `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${address}/resources`,
      {
        headers: {
          'Authorization': `Bearer ${APTOS_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!resourcesResponse.ok) {
      throw new Error(`Failed to fetch resources: ${resourcesResponse.statusText}`);
    }

    const resources = await resourcesResponse.json();

    // Find farming::Staker resource
    const stakerResource = resources.find(
      (resource: any) => resource.type === `${ECHELON_FARMING_ADDRESS}::farming::Staker`
    );

    if (!stakerResource) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No farming staker resource found for this address'
      });
    }

    const userPools = stakerResource.data.user_pools.data;
    const rewards = [];

    // Map reward names to token types
    const REWARD_TOKEN_TYPES: { [key: string]: string } = {
      "Aptos Coin": "0x1::aptos_coin::AptosCoin",
      "Thala APT": "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::staking::ThalaAPT",
      // Add more mappings as needed
    };

    // Process each user pool
    for (const pool of userPools) {
      const farmingId = pool.key;
      const poolData = pool.value;
      const poolRewards = poolData.rewards.data;

      // Process each reward in the pool
      for (const reward of poolRewards) {
        const rewardName = reward.key;
        const rewardData = reward.value;

        // Get claimable reward amount using view function
        const viewPayload = {
          function: `${ECHELON_FARMING_ADDRESS}::farming::claimable_reward_amount`,
          type_arguments: [],
          arguments: [address, rewardName, farmingId]
        };

        const viewResponse = await fetch(
          'https://fullnode.mainnet.aptoslabs.com/v1/view',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${APTOS_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(viewPayload)
          }
        );

        if (viewResponse.ok) {
          const viewResult = await viewResponse.json();
          const claimableAmount = viewResult[0];

          // Format amount (8 decimals)
          const formattedAmount = Number(claimableAmount) / 1e8;

          if (formattedAmount > 0) {
            const tokenType = REWARD_TOKEN_TYPES[rewardName];
            rewards.push({
              token: rewardName,
              tokenType: tokenType || "Unknown",
              amount: formattedAmount,
              rawAmount: claimableAmount,
              farmingId: farmingId,
              stakeAmount: Number(poolData.stake_amount) / 1e8
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: rewards
    });

  } catch (error) {
    console.error('Error fetching Echelon rewards:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 