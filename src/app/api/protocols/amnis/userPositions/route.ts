import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      );
    }

    console.log('Fetching Amnis positions for address:', address);

    // Get base URL from environment or use default
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    
    // Get AMI staking pools using our existing API
    console.log('Fetching AMI staking pools...');
    const stakingPoolsResponse = await fetch(`${baseUrl}/api/protocols/amnis/staking-pools`);
    
    if (!stakingPoolsResponse.ok) {
      throw new Error(`Failed to fetch staking pools: ${stakingPoolsResponse.status} ${stakingPoolsResponse.statusText}`);
    }
    
    const stakingPoolsData = await stakingPoolsResponse.json();
    const pools = stakingPoolsData.pools || [];
    console.log('Staking pools data received:', pools.length, 'pools');
    
    // Get AMI token price from our existing Panora API
    console.log('Fetching AMI price from Panora...');
    const amiPriceResponse = await fetch(`${baseUrl}/api/panora/tokenPrices?chainId=1&tokenAddress=0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451`);
    
    if (!amiPriceResponse.ok) {
      throw new Error(`Failed to fetch AMI price: ${amiPriceResponse.status} ${amiPriceResponse.statusText}`);
    }
    
    const amiPriceData = await amiPriceResponse.json();
    // Extract price from the data array structure
    const amiTokenData = amiPriceData.data?.find((token: any) => 
      token.faAddress === '0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451'
    );
    const amiPrice = amiTokenData?.usdPrice ? parseFloat(amiTokenData.usdPrice) : 0;
    console.log('AMI price:', amiPrice);

    // Get staked amounts for each pool
    const stakedAmounts: {[key: string]: number} = {};
    let totalStakedAmi = 0;
    
    for (const pool of pools) {
      try {
        // Call view function to get staked amount
        const viewPayload = {
          function: "0x485bac3224674ea89846aa50d67523e1aac06b5339713283bb0a72d65ad2ff94::staking::get_staker_amount",
          type_arguments: [],
          arguments: [address, pool.address]
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (process.env.APTOS_API_KEY) {
          headers['Authorization'] = `Bearer ${process.env.APTOS_API_KEY}`;
        }

        const viewResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
          method: 'POST',
          headers,
          body: JSON.stringify(viewPayload),
        });

        if (viewResponse.ok) {
          const viewData = await viewResponse.json();
          const stakedAmount = parseInt(viewData[0] || '0');
          stakedAmounts[pool.address] = stakedAmount;
          totalStakedAmi += stakedAmount;
        }
      } catch (error) {
        console.error(`Error getting staked amount for pool ${pool.address}:`, error);
        stakedAmounts[pool.address] = 0;
      }
    }

    // Create positions array - only AMI staking
    const positions = [];
    
    // Add AMI staking position if user has staked tokens
    if (totalStakedAmi > 0) {
      const totalStakedTokens = totalStakedAmi / 100000000; // Convert from octas to tokens
      const usdValue = totalStakedTokens * amiPrice;
      
      positions.push({
        id: "amnis-ami-staking",
        poolId: "amnis-ami-staking",
        poolName: "AMI Staking",
        token: "0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451",
        tokenSymbol: "AMI",
        stakedAmount: totalStakedTokens.toString(),
        apy: 2.0, // Average APY
        isActive: true,
        usdValue: usdValue
      });
    }

    return NextResponse.json({
      success: true,
      positions: positions,
      totalStakedAmi: totalStakedAmi,
      amiPrice: amiPrice
    });
  } catch (error) {
    console.error("Error fetching Amnis user positions:", error);
    return NextResponse.json(
      { error: "Failed to fetch Amnis user positions", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 