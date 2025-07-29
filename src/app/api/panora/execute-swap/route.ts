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

    // Validate the returned payload structure
    const payload = response.data;
    if (!payload || !payload.function || !Array.isArray(payload.type_arguments) || !Array.isArray(payload.arguments)) {
      console.error('Invalid payload structure returned:', payload);
      return NextResponse.json(
        { error: 'Invalid transaction payload structure' },
        { status: 400 }
      );
    }

    console.log('Swap successful, returning validated data');
    console.log('Payload structure:', {
      function: payload.function,
      typeArgumentsCount: payload.type_arguments.length,
      argumentsCount: payload.arguments.length
    });
    
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('Error in execute-swap route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 