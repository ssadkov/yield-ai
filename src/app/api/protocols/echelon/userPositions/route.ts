import { NextRequest, NextResponse } from 'next/server';

// Import the account-collateral-markets logic directly
import { getAccountCollateralMarkets } from '../account-collateral-markets/route';

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

    // Call the account-collateral-markets function directly
    const data = await getAccountCollateralMarkets(address);

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch user positions');
    }

    if (!data.data || !data.data.userPositions) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Transform userPositions to match the expected format
    const positions = data.data.userPositions.map((position: any) => {
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