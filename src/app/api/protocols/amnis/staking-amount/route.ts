import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const poolAddress = searchParams.get('poolAddress');

    if (!userAddress || !poolAddress) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Both userAddress and poolAddress parameters are required' 
        },
        { status: 400 }
      );
    }

    console.log('Getting staked AMI amount for user:', userAddress, 'pool:', poolAddress);

    // Call the view function to get staked amount
    const viewPayload = {
      function: "0x485bac3224674ea89846aa50d67523e1aac06b5339713283bb0a72d65ad2ff94::staking::get_staker_amount",
      type_arguments: [],
      arguments: [userAddress, poolAddress]
    };

    console.log('Calling view function with payload:', viewPayload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (process.env.APTOS_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.APTOS_API_KEY}`;
    }

    const response = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
      method: 'POST',
      headers,
      body: JSON.stringify(viewPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('View function error:', response.status, errorText);
      return NextResponse.json(
        { 
          success: false, 
          error: `View function error: ${response.status} - ${errorText}` 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    // console.log('View function response:', data);

    // The response should be an array with the staked amount as the first element
    const stakedAmount = data[0] || 0;
    
    // Convert from smallest unit to AMI tokens (assuming 8 decimals like most Aptos tokens)
    const stakedAmountInTokens = Number(stakedAmount) / Math.pow(10, 8);

    return NextResponse.json({
      success: true,
      stakedAmount: stakedAmountInTokens,
      rawAmount: stakedAmount,
      userAddress,
      poolAddress
    });

  } catch (error) {
    console.error('Error getting staked AMI amount:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get staked AMI amount',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 