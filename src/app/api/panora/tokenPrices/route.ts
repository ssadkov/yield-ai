import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chainId = searchParams.get('chainId');
    const tokenAddress = searchParams.get('tokenAddress');

    if (!chainId) {
      return NextResponse.json(
        createErrorResponse(new Error('ChainId parameter is required')),
        { status: 400 }
      );
    }

    const queryParams = new URLSearchParams();
    queryParams.append('chainId', chainId);
    if (tokenAddress) {
      queryParams.append('tokenAddress', tokenAddress);
    }

    const baseUrl = process.env.PANORA_API_URL || 'https://api.panora.exchange';

    const response = await fetch(`${baseUrl}/prices?${queryParams.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.PANORA_API_KEY || '',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to fetch prices: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(createSuccessResponse(data));
  } catch (error) {
    console.error('Error in tokenPrices route:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        createErrorResponse(error),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createErrorResponse(new Error('Internal server error')),
      { status: 500 }
    );
  }
} 