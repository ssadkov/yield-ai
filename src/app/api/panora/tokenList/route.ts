import { NextRequest, NextResponse } from 'next/server';
import { PanoraTokensService } from '@/lib/services/panora/tokens';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';
import { SUPPORTED_CHAIN_IDS, DEFAULT_CHAIN_ID } from '@/lib/types/panora';

export async function GET(request: NextRequest) {
  try {
    // Get chainId from query params, default to Aptos (1)
    const searchParams = request.nextUrl.searchParams;
    const chainId = parseInt(searchParams.get('chainId') || String(DEFAULT_CHAIN_ID), 10);

    // Validate chainId
    if (isNaN(chainId)) {
      return NextResponse.json(
        createErrorResponse(new Error('Invalid chainId')),
        { status: 400 }
      );
    }

    // Initialize service and get token list
    const service = new PanoraTokensService();
    const response = await service.getTokenList(chainId);

    return NextResponse.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Error in tokenList route:', error);
    
    if (error instanceof Error) {
      // Handle specific error cases
      if (error.message.includes('Unsupported chainId')) {
        return NextResponse.json(
          createErrorResponse(new Error(`Unsupported chainId. Supported chains: ${Object.values(SUPPORTED_CHAIN_IDS).join(', ')}`)),
          { status: 400 }
        );
      }
      
      if (error.message.includes('404')) {
        return NextResponse.json(
          createErrorResponse(new Error('Chain not supported')),
          { status: 404 }
        );
      }
      
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