import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    console.log('Getting APT balance for address:', address);
    console.log('APTOS_API_KEY exists:', !!process.env.APTOS_API_KEY);

    // Use the working API endpoint that we know works
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
        { error: 'Failed to fetch balance from Aptos API' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // console.log('Aptos API response:', data);

    if (!data.data?.current_fungible_asset_balances) {
      return NextResponse.json({ aptBalance: 0 });
    }

    // Find APT balance
    const aptBalance = data.data.current_fungible_asset_balances.find(
      (balance: any) => balance.asset_type === '0x1::aptos_coin::AptosCoin'
    );

    if (!aptBalance) {
      return NextResponse.json({ aptBalance: 0 });
    }

    // Convert from octas to APT (divide by 10^8)
    const aptAmount = Number(aptBalance.amount) / Math.pow(10, 8);
    console.log('APT balance found:', aptAmount);

    return NextResponse.json({ aptBalance: aptAmount });
  } catch (error) {
    console.error('Error fetching APT balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch APT balance' },
      { status: 500 }
    );
  }
} 