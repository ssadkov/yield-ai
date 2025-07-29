import { NextRequest, NextResponse } from 'next/server';
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
    // console.log('Aptos API response:', data);

    const balances = data.data?.current_fungible_asset_balances || [];
    const result = { balances };

    return NextResponse.json(createSuccessResponse(result));
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