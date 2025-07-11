import { NextRequest, NextResponse } from 'next/server';

const ECHELON_FARMING_ADDRESS = "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba";
const APTOS_API_KEY = process.env.APTOS_API_KEY;

// Map reward names to token types
const REWARD_TOKEN_TYPES: { [key: string]: string } = {
  "Aptos Coin": "0x1::aptos_coin::AptosCoin",
  "Thala APT": "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::staking::ThalaAPT",
  // Add more mappings as needed
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, rewardName, farmingId } = body;

    if (!userAddress || !rewardName || !farmingId) {
      return NextResponse.json({ 
        success: false, 
        error: 'userAddress, rewardName, and farmingId are required' 
      }, { status: 400 });
    }

    if (!APTOS_API_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'APTOS_API_KEY is not configured' 
      }, { status: 500 });
    }

    // Get the token type for the reward
    const tokenType = REWARD_TOKEN_TYPES[rewardName];
    if (!tokenType) {
      return NextResponse.json({ 
        success: false, 
        error: `Unknown reward token type for: ${rewardName}` 
      }, { status: 400 });
    }

    // Create transaction payload for scripts::claim_reward
    const transactionPayload = {
      type: "entry_function_payload" as const,
      function: `${ECHELON_FARMING_ADDRESS}::scripts::claim_reward`,
      type_arguments: [tokenType],
      arguments: [farmingId]
    };

    return NextResponse.json({
      success: true,
      data: {
        transactionPayload,
        message: 'Transaction payload created successfully. Use this payload with wallet.signAndSubmitTransaction()'
      }
    });

  } catch (error) {
    console.error('Error creating claim transaction:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 