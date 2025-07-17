import { NextRequest, NextResponse } from 'next/server';
import { AptosApiService } from '@/lib/services/aptos/api';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        createErrorResponse(new Error('Address parameter is required')),
        { status: 400 }
      );
    }

    console.log('Getting balances for address:', address);
    const apiService = new AptosApiService();
    const data = await apiService.getBalances(address);
    console.log('Balances response:', data);

    return NextResponse.json(createSuccessResponse(data));
  } catch (error) {
    console.error('Error in balances route:', error);
    
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