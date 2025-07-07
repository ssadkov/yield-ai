import { NextRequest, NextResponse } from 'next/server';

// Auro Finance contract addresses (mainnet)
const AURO_ADDRESS = "0x50a340a19e6ada1be07192c042786ca6a9651d5c845acc8727e8c6416a56a32c";

export async function GET(request: NextRequest) {
  try {
    console.log('=== Auro API Route Started ===');
    
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    console.log('Request URL:', request.url);
    console.log('Address parameter:', address);

    if (!address) {
      console.log('No address provided, returning 400');
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
    }

    console.log('Getting collection address for Auro Finance...');

    // Get collection address using direct HTTP request to fullnode
    const viewPayload = {
      function: `${AURO_ADDRESS}::auro_pool::position_nft_collection`,
      type_arguments: [],
      arguments: []
    };

    console.log('Calling view function with payload:', viewPayload);

    const response = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(viewPayload)
    });

    console.log('View function response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('View function error:', response.status, errorText);
      throw new Error(`View function error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('View function response data:', data);

    const collectionAddress = data[0];
    console.log('Collection address:', collectionAddress);

    const result = {
      success: true,
      collectionAddress: collectionAddress,
      message: "Collection address retrieved successfully"
    };

    console.log('Returning result:', JSON.stringify(result, null, 2));
    console.log('=== Auro API Route Completed ===');

    return NextResponse.json(result);

  } catch (error) {
    console.error('=== Auro API Route Error ===');
    console.error('Error getting collection address:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Failed to get collection address', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 