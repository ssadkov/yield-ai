import { NextRequest, NextResponse } from 'next/server';
import { AptosWalletService } from '@/lib/services/aptos/wallet';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    const walletService = new AptosWalletService();
    const data = await walletService.getBalances(address);

    return NextResponse.json({ data, status: 200 });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet balance' },
      { status: 500 }
    );
  }
} 