import { NextRequest, NextResponse } from 'next/server';
import { PanoraPricesService } from '@/lib/services/panora/prices';
import { DEFAULT_CHAIN_ID, SupportedChainId } from '@/lib/types/panora';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenAddresses = searchParams.get('tokenAddress')?.split(',');
    const chainId = (Number(searchParams.get('chainId')) || DEFAULT_CHAIN_ID) as SupportedChainId;

    const pricesService = PanoraPricesService.getInstance();
    const response = await pricesService.getPrices(chainId, tokenAddresses);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching token prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token prices' },
      { status: 500 }
    );
  }
} 