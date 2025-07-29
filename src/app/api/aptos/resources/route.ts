import { NextRequest, NextResponse } from 'next/server';
import { http } from '@/lib/utils/http';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';

interface AptosResource {
  type: string;
  data: any;
}

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    console.log('Received request for resources with address:', address);

    if (!address) {
      console.error('Address is missing');
      return NextResponse.json(
        createErrorResponse(new Error('Address parameter is required')),
        { status: 400 }
      );
    }

    const url = `https://api.mainnet.aptoslabs.com/v1/accounts/${address}/resources`;
    console.log('Making request to Aptos API:', url);

    const response = await http.get<AptosResource[]>(url, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('Aptos API response type:', typeof response);
    console.log('Aptos API response is array:', Array.isArray(response));
    console.log('Aptos API response length:', Array.isArray(response) ? response.length : 'N/A');
    console.log('Aptos API response first item:', Array.isArray(response) && response.length > 0 ? response[0] : 'N/A');

    if (!response || !Array.isArray(response)) {
      console.error('Invalid response format:', response);
      return NextResponse.json(
        createErrorResponse(new Error('Invalid response format from Aptos API')),
        { status: 500 }
      );
    }

    console.log('Returning successful response with', response.length, 'resources');
    return NextResponse.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Error in resources route:', error);
    
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