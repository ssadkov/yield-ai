import { NextRequest, NextResponse } from 'next/server';
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

    console.log('Getting balances for address:', address);
    console.log('APTOS_API_KEY exists:', !!process.env.APTOS_API_KEY);

    // Make direct call to Aptos API from server side
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if available
    if (process.env.APTOS_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.APTOS_API_KEY}`;
    }

    const response = await fetch(`https://indexer.mainnet.aptoslabs.com/v1/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `
          query GetAccountBalances($address: String!) {
            current_fungible_asset_balances(
              where: {owner_address: {_eq: $address}, amount: {_gt: "0"}}
            ) {
              asset_type
              amount
              last_transaction_timestamp
            }
          }
        `,
        variables: { address },
      }),
    });

    if (!response.ok) {
      console.error('Aptos API error:', response.status, response.statusText);
      return NextResponse.json(
        createErrorResponse(new Error(`Aptos API error: ${response.status}`)),
        { status: response.status }
      );
    }

    const data = await response.json();
    
    const balances = data.data?.current_fungible_asset_balances || [];
    
    // Log tokens with invalid amounts for debugging
    const invalidBalances = balances.filter((b: any) => {
      const amount = b.amount;
      return !amount || amount === '' || amount === 'undefined' || amount === 'null' || isNaN(parseFloat(amount));
    });
    
    if (invalidBalances.length > 0) {
      console.warn('⚠️ Found tokens with invalid amounts from Aptos GraphQL:', invalidBalances.length);
      invalidBalances.forEach((b: any) => {
        console.warn('  - Token:', b.asset_type, 'Amount:', b.amount);
      });
    }
    
    const result = { balances };

    return NextResponse.json(createSuccessResponse(result));
  } catch (error) {
    console.error('Error in walletBalance route:', error);
    
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