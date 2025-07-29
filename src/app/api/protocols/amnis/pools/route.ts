import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Fetch data from Amnis Finance API
    const response = await fetch('https://api.amnis.finance/api/v1/stake/info', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
    });

    if (!response.ok) {
      throw new Error(`Amnis API returned status ${response.status}`);
    }

    const data = await response.json();
    // console.log('Amnis API response:', data);

    // Create two pools: APT staking and amAPT
    const pools = [
      {
        id: "amnis-apt-staking",
        name: "APT Liquid Staking",
        description: "Stake APT and receive stAPT tokens",
        asset: "APT",
        token: "0x1::aptos_coin::AptosCoin",
        stakingToken: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt",
        apr: data.apr || 0,
        totalStaked: data.stAptTotalSupply || 0,
        minStake: "1000000", // 1 APT minimum
        maxStake: "1000000000000", // No maximum
        isActive: true,
        // Additional data from API
        aptPrice: data.aptPrice,
        staker: data.staker,
        liquidRate: data.liquidRate
      },
      {
        id: "amnis-amapt",
        name: "amAPT Token",
        description: "Amnis Aptos token for liquid staking",
        asset: "amAPT",
        token: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt",
        stakingToken: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt",
        apr: data.apr || 0, // Same APR as APT staking
        totalStaked: data.amAptTotalSupply || 0,
        minStake: "1000000", // 1 amAPT minimum
        maxStake: "1000000000000", // No maximum
        isActive: true,
        // Additional data from API
        amAptPrice: data.amAptPrice,
        pancakeRate: data.pancakeRate,
        panoraRate: data.panoraRate,
        cellanaRate: data.cellanaRate,
        pancakeswap: data.pancakeswap
      }
    ];

    return NextResponse.json({
      success: true,
      pools: pools,
      // Include raw API data for reference
      apiData: data
    }, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
        'Cdn-Cache-Control': 'max-age=30',
        'Surrogate-Control': 'max-age=30'
      }
    });
  } catch (error) {
    console.error("Error fetching Amnis pools:", error);
    return NextResponse.json(
      { error: "Failed to fetch Amnis pools" },
      { status: 500 }
    );
  }
} 