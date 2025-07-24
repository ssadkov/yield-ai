import { NextRequest, NextResponse } from 'next/server';

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

    // Use the new account-collateral-markets API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/protocols/echelon/account-collateral-markets?address=${address}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch account collateral markets: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch user positions');
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