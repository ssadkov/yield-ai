import { NextRequest, NextResponse } from 'next/server';
import { PanoraSwapService } from '@/lib/services/panora/swap';

export async function POST(request: NextRequest) {
  try {
    console.log('execute-swap route called');
    const body = await request.json();
    console.log('Request body:', body);
    
    const { quoteData, walletAddress } = body;

    if (!quoteData) {
      console.log('Missing quoteData');
      return NextResponse.json(
        { error: 'Quote data is required' },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      console.log('Missing walletAddress');
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    console.log('Calling PanoraSwapService.executeSwap...');
    const swapService = PanoraSwapService.getInstance();
    const response = await swapService.executeSwap(quoteData, walletAddress);
    console.log('Execute swap response:', response);

    if (!response.success) {
      console.log('Swap failed:', response.error);
      return NextResponse.json(
        { error: response.error },
        { status: 400 }
      );
    }

    console.log('Swap successful, returning data');
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error in execute-swap route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 