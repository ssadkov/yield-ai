import { NextRequest, NextResponse } from 'next/server';
import { http } from '@/lib/utils/http';
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

    const response = await http.get(`https://api.panora.dev/v1/prices?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${process.env.PANORA_API_KEY}`,
      }
    });

    return NextResponse.json(createSuccessResponse(response.data));
  } catch (error) {
    console.error('Error in prices route:', error);
    
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