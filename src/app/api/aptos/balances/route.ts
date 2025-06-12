import { NextRequest, NextResponse } from 'next/server';
import { http } from '@/lib/utils/http';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';

interface AptosResponse {
  data: {
    current_fungible_asset_balances: Array<{
      asset_type: string;
      amount: string;
      last_transaction_timestamp: string;
    }>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    console.log('Received request for address:', address);

    if (!address) {
      console.error('Address is missing');
      return NextResponse.json(
        createErrorResponse(new Error('Address parameter is required')),
        { status: 400 }
      );
    }

    const query = `
      query GetAccountBalances($address: String!) {
        current_fungible_asset_balances(
          where: {owner_address: {_eq: $address}, amount: {_gt: "0"}}
        ) {
          asset_type
          amount
          last_transaction_timestamp
        }
      }
    `;

    console.log('Making request to Aptos API with query:', query);
    console.log('API Key:', process.env.APTOS_API_KEY ? 'Present' : 'Missing');

    const response = await http.post<AptosResponse>('https://indexer.mainnet.aptoslabs.com/v1/graphql', {
      query,
      variables: { address },
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APTOS_API_KEY}`,
      }
    });

    console.log('Aptos API response:', response);

    if (!response.data) {
      console.error('No data in response');
      return NextResponse.json(
        createErrorResponse(new Error('No data received from Aptos API')),
        { status: 500 }
      );
    }

    return NextResponse.json(createSuccessResponse(response.data));
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