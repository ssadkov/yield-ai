import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching AMI staking pools from Amnis API...');
    
    const response = await fetch('https://api.amnis.finance/api/v1/staking-ami/pools', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'YieldAI/1.0',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the data to include additional calculated fields
    const transformedPools = data.map((pool: any) => ({
      ...pool,
      // Convert timestamps to readable dates
      startDate: new Date(pool.startTime * 1000).toLocaleDateString(),
      endDate: pool.endTime > 0 ? new Date(pool.endTime * 1000).toLocaleDateString() : 'No end date',
      // Convert lock duration from seconds to days
      lockDurationDays: Math.floor(pool.lockDuration / 86400),
      // Calculate rate as percentage
      ratePercentage: (pool.rate * 100).toFixed(2),
      // Add status based on current time
      status: pool.isPause ? 'Paused' : 
              pool.startTime > Math.floor(Date.now() / 1000) ? 'Upcoming' : 
              (pool.endTime > 0 && pool.endTime < Math.floor(Date.now() / 1000)) ? 'Ended' : 'Active'
    }));

    return NextResponse.json({
      success: true,
      pools: transformedPools,
      rawData: data
    });

  } catch (error) {
    console.error('Error fetching AMI staking pools:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch AMI staking pools',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 