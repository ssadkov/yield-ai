import { NextRequest, NextResponse } from 'next/server';
import { AptosPortfolioService } from '@/lib/services/aptos/portfolio';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        createErrorResponse(new Error('Address parameter is required')),
        { status: 400 }
      );
    }

    const service = new AptosPortfolioService();
    const portfolio = await service.getPortfolio(address);

    return NextResponse.json(createSuccessResponse(portfolio));
  } catch (error) {
    console.error('Error in portfolio route:', error);
    
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