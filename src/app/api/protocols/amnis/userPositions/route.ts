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

    // TODO: Implement actual Amnis Finance API integration
    // For now, return mock data
    const positions = [
      {
        id: "amnis-position-1",
        poolId: "amnis-apt-staking",
        poolName: "APT Liquid Staking",
        token: "0x1::aptos_coin::AptosCoin",
        stakingToken: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt",
        stakedAmount: "10000000", // 10 APT
        stakingTokenAmount: "10000000", // 10 stAPT
        apy: 7.5,
        rewards: "750000", // 0.75 APT in rewards
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    return NextResponse.json({
      success: true,
      positions: positions
    });
  } catch (error) {
    console.error("Error fetching Amnis user positions:", error);
    return NextResponse.json(
      { error: "Failed to fetch Amnis user positions" },
      { status: 500 }
    );
  }
} 