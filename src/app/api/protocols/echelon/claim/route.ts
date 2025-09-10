import { NextRequest, NextResponse } from 'next/server';

const ECHELON_FARMING_ADDRESS = "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba";
const APTOS_API_KEY = process.env.APTOS_API_KEY;

// Map reward names to token types
const REWARD_TOKEN_TYPES: { [key: string]: string } = {
  "Aptos Coin": "0x1::aptos_coin::AptosCoin",
  "Thala APT": "0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6::staking::ThalaAPT",
  "StakedThalaAPT": "0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6::staking::StakedThalaAPT",
  "ECHO": "0xb2c7780f0a255a6137e5b39733f5a4c85fe093c549de5c359c1232deef57d1b7",
  "MKL": "0x5ae6789dd2fec1a9ec9cccfb3acaf12e93d432f0a3a42c92fe1a9d490b7bbc06::mkl_token::MKL",
  "AMI": "0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451",
  "LSD": "0x53a30a6e5936c0a4c5140daed34de39d17ca7fcae08f947c02e979cef98a3719::coin::LSD",
  "THL": "0x7fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615::thl_coin::THL",
  "CELL": "0x2ebb2ccac5e027a87fa0e2e5f656a3a4238d6a48d93ec9b610d570fc0aa0df12",
  "VIBE": "0xeedba439a4ab8987a995cf5cfefebd713000b3365718a29dfbc36bc214445fb8",
  // Add more mappings as needed
};

// Map token symbols to full reward names (reverse mapping)
const TOKEN_SYMBOL_TO_REWARD_NAME: { [key: string]: string } = {
  "APT": "Aptos Coin",
  "thAPT": "Thala APT",
  "sthAPT": "StakedThalaAPT",
  "ECHO": "ECHO",
  "MKL": "MKL",
  "AMI": "AMI",
  "LSD": "LSD",
  "THL": "THL",
  "CELL": "CELL",
  "VIBE": "VIBE",
  // Add more mappings as needed
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, rewardName, farmingId } = body;

    // if (!userAddress || !rewardName || !farmingId) {
    //   return NextResponse.json({ 
    //     success: false, 
    //     error: 'userAddress, rewardName, and farmingId are required' 
    //   }, { status: 400 });
    // }

    if (!APTOS_API_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'APTOS_API_KEY is not configured' 
      }, { status: 500 });
    }

    // Get the token type for the reward
    // First try to find by symbol, then by full name
    let fullRewardName = rewardName;
    if (TOKEN_SYMBOL_TO_REWARD_NAME[rewardName]) {
      fullRewardName = TOKEN_SYMBOL_TO_REWARD_NAME[rewardName];
    }
    
    const tokenType = REWARD_TOKEN_TYPES[fullRewardName];
    // if (!tokenType) {
    //   return NextResponse.json({ 
    //     success: false, 
    //     error: `Unknown reward token type for: ${rewardName}` 
    //   }, { status: 400 });
    // }

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