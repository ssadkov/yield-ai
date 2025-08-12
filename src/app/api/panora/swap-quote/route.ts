import { NextRequest, NextResponse } from 'next/server';
import { PanoraSwapService } from '@/lib/services/panora/swap';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      chainId,
      fromTokenAddress,
      toTokenAddress,
      fromTokenAmount,
      toWalletAddress,
      slippagePercentage,
      integratorFeeAddress,
      integratorFeePercentage,
      getTransactionData
    } = body;

    // Validate required fields
    if (!chainId || !fromTokenAddress || !toTokenAddress || !fromTokenAmount || !toWalletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const swapService = PanoraSwapService.getInstance();
    const response = await swapService.getSwapQuote({
      fromToken: fromTokenAddress,
      toToken: toTokenAddress,
      amount: fromTokenAmount,
      slippage: parseFloat(slippagePercentage || "1") / 100, // Convert percentage to decimal
      toWalletAddress,
    });

    if (!response.success) {
      return NextResponse.json(
        { error: response.error },
        { status: 400 }
      );
    }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error in swap-quote route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 