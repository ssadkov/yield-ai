import { NextRequest, NextResponse } from 'next/server';
import { getWalletBalance } from '@/lib/services/wallet-api';

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    console.log('Testing wallet service for address:', address);

    // Test the wallet service directly
    const result = await getWalletBalance(address);

    console.log('Wallet service result:', result);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in test wallet service:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to test wallet service',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
