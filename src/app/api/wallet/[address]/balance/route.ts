import { NextRequest, NextResponse } from 'next/server';
import { getWalletBalance } from '@/lib/services/wallet-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    // Validate Aptos address format
    const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
    const aptosAddressRegex = /^[0-9a-fA-F]{64}$/;
    if (!aptosAddressRegex.test(cleanAddress)) {
      return NextResponse.json(
        { error: 'Invalid Aptos wallet address format' },
        { status: 400 }
      );
    }

    // Get wallet balance using existing service (передаем адрес с 0x как в test-debug)
    const walletData = await getWalletBalance(`0x${cleanAddress}`);

    // Transform data to match our API format
    const response = {
      address: `0x${cleanAddress}`, // Добавляем 0x префикс
      timestamp: new Date().toISOString(),
      totalValueUSD: walletData.totalValueUSD || 0,
      tokens: walletData.tokens?.map(token => ({
        symbol: token.symbol,
        name: token.name,
        balance: token.balance,
        decimals: token.decimals,
        priceUSD: token.priceUSD || 0,
        valueUSD: token.valueUSD || 0
      })) || []
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch wallet data' },
      { status: 500 }
    );
  }
} 