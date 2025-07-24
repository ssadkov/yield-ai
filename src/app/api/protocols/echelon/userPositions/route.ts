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
    const positions = result.data.userPositions.map((position: any) => {
      const transformedPosition: any = {
        market: position.market,
        coin: position.coin,
        supply: position.supply || 0,
        borrow: position.borrow || 0
      };

      // Add amount and type fields
      if (position.supply > 0) {
        transformedPosition.amount = position.supply;
        transformedPosition.type = 'supply';
      } else if (position.borrow > 0) {
        transformedPosition.amount = position.borrow;
        transformedPosition.type = 'borrow';
      }

      return transformedPosition;
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