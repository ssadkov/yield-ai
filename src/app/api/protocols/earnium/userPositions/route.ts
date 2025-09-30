import { NextResponse } from 'next/server';

// Earnium user positions endpoint - returns positions from rewards API
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address is required' }, { status: 400 });
    }

    console.log('🔍 Earnium userPositions API called for address:', address);

    // Fetch rewards data to get user positions
    const rewardsResponse = await fetch(`${request.url.replace('/userPositions', '/rewards')}?address=${address}`);
    
    if (!rewardsResponse.ok) {
      console.log('⚠️ Earnium rewards API failed, returning empty positions');
      return NextResponse.json({ success: true, data: [] });
    }

    const rewardsData = await rewardsResponse.json();
    
    if (!rewardsData.success || !Array.isArray(rewardsData.data)) {
      console.log('⚠️ Earnium rewards API returned invalid data, returning empty positions');
      return NextResponse.json({ success: true, data: [] });
    }

    // Filter positions with actual stakes
    const positions = rewardsData.data.filter((pool: any) => {
      try {
        const stakedRaw = BigInt(pool?.stakedRaw ?? '0');
        return stakedRaw > BigInt(0);
      } catch {
        return false;
      }
    });

    console.log(`🔍 Earnium userPositions: found ${positions.length} positions with stakes`);

    return NextResponse.json({ 
      success: true, 
      data: positions 
    }, {
      headers: {
        'Cache-Control': 'public, max-age=2, s-maxage=2, stale-while-revalidate=4'
      }
    });
  } catch (error) {
    console.error('🔍 Earnium userPositions API error:', error);
    return NextResponse.json({ success: true, data: [] }, { status: 200 });
  }
}


