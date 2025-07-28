import { NextRequest, NextResponse } from 'next/server';
import { PanoraSwapService } from '@/lib/services/panora/swap';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quoteData, walletAddress } = body;

    if (!quoteData) {
      return NextResponse.json(
        { error: 'Quote data is required' },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const swapService = PanoraSwapService.getInstance();
    const response = await swapService.executeSwap(quoteData, walletAddress);

    if (!response.success) {
      return NextResponse.json(
        { error: response.error },
        { status: 400 }
      );
    }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error in swap route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 