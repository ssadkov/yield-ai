import { NextRequest, NextResponse } from 'next/server';
import { getAccountCollateralMarkets } from '@/lib/protocols/echelon/accountCollateralMarkets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    // Call the function directly instead of making an HTTP request
    const result = await getAccountCollateralMarkets(address);

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch user positions');
    }

    if (!result.data || !result.data.userPositions) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Transform userPositions to match the expected format
    const positions: any[] = [];
    
    result.data.userPositions.forEach((position: any) => {
      const basePosition = {
        market: position.market,
        coin: position.coin,
        supply: position.supply || 0,
        borrow: position.borrow || 0
      };

      // Create separate position for supply if exists
      if (position.supply > 0) {
        positions.push({
          ...basePosition,
          amount: position.supply,
          type: 'supply'
        });
      }

      // Create separate position for borrow if exists
      if (position.borrow > 0) {
        positions.push({
          ...basePosition,
          amount: position.borrow,
          type: 'borrow'
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: positions
    });

  } catch (error) {
    console.error('Error fetching user positions:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 